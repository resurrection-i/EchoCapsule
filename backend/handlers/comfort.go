package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"idol-capsule-backend/models"

	"github.com/gin-gonic/gin"
)

// CheckTodayFree 检查某地址今日免费安慰额度是否已用
// GET /comfort/today-free?address=0x...
func (h *Handler) CheckTodayFree(c *gin.Context) {
	addr := strings.ToLower(c.Query("address"))
	if addr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}

	// 今日 00:00:00 UTC
	now := time.Now().UTC()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	var count int64
	h.DB.Model(&models.ComfortRecord{}).
		Where("wallet_address = ? AND created_at >= ?", addr, startOfDay).
		Count(&count)

	c.JSON(http.StatusOK, gin.H{"used": count > 0})
}

// GetSuperComforts 获取付费深度共鸣列表（偶像回响墙），支持分页
// GET /comfort/super?page=1&limit=10&sort=time|amount
func (h *Handler) GetSuperComforts(c *gin.Context) {
	page := 1
	limit := 10
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	sort := c.DefaultQuery("sort", "time")

	var comforts []models.SuperComfort
	var total int64
	h.DB.Model(&models.SuperComfort{}).Count(&total)

	orderClause := "created_at DESC"
	if sort == "amount" {
		orderClause = "CAST(amount AS UNSIGNED) DESC"
	}

	h.DB.Order(orderClause).
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&comforts)

	type ComfortDTO struct {
		ID            uint   `json:"id"`
		WalletAddress string `json:"wallet_address"`
		Message       string `json:"message"`
		Amount        string `json:"amount"`
		TxHash        string `json:"tx_hash"`
		BlockNumber   uint64 `json:"block_number"`
		CreatedAt     string `json:"created_at"`
	}

	dtos := make([]ComfortDTO, 0, len(comforts))
	for _, sc := range comforts {
		ts := sc.CreatedAt
		if ts.IsZero() {
			ts = time.Now()
		}
		dtos = append(dtos, ComfortDTO{
			ID:            sc.ID,
			WalletAddress: sc.WalletAddress,
			Message:       sc.Message,
			Amount:        sc.Amount,
			TxHash:        sc.TxHash,
			BlockNumber:   sc.BlockNumber,
			CreatedAt:     ts.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  dtos,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
