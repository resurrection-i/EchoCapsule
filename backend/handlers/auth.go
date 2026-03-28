package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"idol-capsule-backend/models"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ========== 请求/响应结构 ==========

type NonceRequest struct {
	Address string `json:"address" binding:"required"`
}

type VerifyRequest struct {
	Address   string `json:"address" binding:"required"`
	Signature string `json:"signature" binding:"required"`
	Nonce     string `json:"nonce" binding:"required"`
}

type AuthClaims struct {
	Address string `json:"address"`
	Role    string `json:"role"`
	jwt.RegisteredClaims
}

// ========== /auth/nonce ==========

// GetNonce 为地址生成随机 nonce，存入 users 表（upsert）
func (h *Handler) GetNonce(c *gin.Context) {
	var req NonceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	addr := strings.ToLower(req.Address)

	// 生成 16 字节随机 nonce
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate nonce"})
		return
	}
	nonce := hex.EncodeToString(nonceBytes)

	// upsert: 不存在则创建，存在则更新 nonce
	var user models.User
	result := h.DB.Where("wallet_address = ?", addr).First(&user)
	if result.Error != nil {
		// 新用户：判断是否偶像
		role := "fan"
		if strings.EqualFold(addr, h.IdolAddress) {
			role = "idol"
		}
		user = models.User{
			WalletAddress: addr,
			Role:          role,
			Nonce:         nonce,
		}
		h.DB.Create(&user)
	} else {
		h.DB.Model(&user).Update("nonce", nonce)
	}

	c.JSON(http.StatusOK, gin.H{
		"nonce":   nonce,
		"message": fmt.Sprintf("Welcome to Idol Capsule!\n\nSign this message to verify your identity.\n\nNonce: %s", nonce),
	})
}

// ========== /auth/verify ==========

// VerifySignature 校验 SIWE 签名，返回 JWT
func (h *Handler) VerifySignature(c *gin.Context) {
	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	addr := strings.ToLower(req.Address)

	// 1. 从数据库取 nonce
	var user models.User
	if err := h.DB.Where("wallet_address = ?", addr).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Address not registered, call /auth/nonce first"})
		return
	}
	if user.Nonce != req.Nonce {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Nonce mismatch"})
		return
	}

	// 2. 重建签名消息（与前端保持一致）
	message := fmt.Sprintf("Welcome to Idol Capsule!\n\nSign this message to verify your identity.\n\nNonce: %s", req.Nonce)

	// 3. 以太坊个人签名前缀
	prefixedMsg := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	msgHash := crypto.Keccak256Hash([]byte(prefixedMsg))

	// 4. 解码签名
	sigBytes, err := hex.DecodeString(strings.TrimPrefix(req.Signature, "0x"))
	if err != nil || len(sigBytes) != 65 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid signature format"})
		return
	}

	// 5. 恢复 v 值（MetaMask 用 27/28，需要转为 0/1）
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	// 6. 恢复公钥，推导地址
	pubKey, err := crypto.SigToPub(msgHash.Bytes(), sigBytes)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to recover public key"})
		return
	}
	recoveredAddr := strings.ToLower(crypto.PubkeyToAddress(*pubKey).Hex())

	if recoveredAddr != addr {
		c.JSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("Signature mismatch: got %s", recoveredAddr)})
		return
	}

	// 7. 用完即废：刷新 nonce（防重放）
	newNonceBytes := make([]byte, 16)
	rand.Read(newNonceBytes)
	h.DB.Model(&user).Update("nonce", hex.EncodeToString(newNonceBytes))

	// 8. 签发 JWT（24h 有效期）
	claims := AuthClaims{
		Address: common.HexToAddress(req.Address).Hex(), // 校验和格式
		Role:    user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   addr,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sign JWT"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":   tokenStr,
		"address": claims.Address,
		"role":    user.Role,
	})
}

// ========== /auth/me ==========

// GetMe 验证 JWT 并返回当前用户信息
func (h *Handler) GetMe(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

	claims := &AuthClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(h.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address": claims.Address,
		"role":    claims.Role,
	})
}
