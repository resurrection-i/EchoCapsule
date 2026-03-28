package handlers

import (
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"idol-capsule-backend/models"
	"idol-capsule-backend/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	DB          *gorm.DB
	Pinata      *services.PinataService
	JWTSecret   string
	IdolAddress string
}

// ========== 情绪更新请求 ==========

type EmotionUpdateRequest struct {
	EmotionID uint8  `json:"emotion_id"`
	PhotoCID  string `json:"photo_cid"`
	MusicID   uint8  `json:"music_id"`
	MoodText  string `json:"mood_text"`
	Signature string `json:"signature"`
	Deadline  uint64 `json:"deadline"`
}

// SubmitEmotionUpdate 偶像提交情绪更新（接收签名，写入任务队列）
func (h *Handler) SubmitEmotionUpdate(c *gin.Context) {
	var req EmotionUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[SubmitEmotionUpdate] JSON bind error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.EmotionID > 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "emotion_id must be 0-4"})
		return
	}
	if req.Signature == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "signature is required"})
		return
	}
	if req.Deadline == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "deadline is required"})
		return
	}

	task := models.Task{
		EmotionID: req.EmotionID,
		PhotoCID:  req.PhotoCID,
		MusicID:   req.MusicID,
		MoodText:  req.MoodText,
		Signature: req.Signature,
		Deadline:  req.Deadline,
		Status:    "pending",
	}

	if err := h.DB.Create(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task_id": task.ID,
		"status":  "pending",
		"message": "Emotion update task queued",
	})
}

// UploadPhoto 上传偶像照片到 IPFS
func (h *Handler) UploadPhoto(c *gin.Context) {
	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No photo file provided"})
		return
	}
	defer file.Close()

	fileData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	result, err := h.Pinata.UploadFile(fileData, header.Filename)
	if err != nil {
		log.Println("[Upload] Pinata error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload to IPFS", "detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cid":       result.IpfsHash,
		"ipfs_url":  "https://ipfs.io/ipfs/" + result.IpfsHash,
		"file_name": header.Filename,
	})
}

// GetTaskStatus 查询任务状态（轮询方案）
func (h *Handler) GetTaskStatus(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.Task
	if err := h.DB.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task_id": task.ID,
		"status":  task.Status,
		"tx_hash": task.TxHash,
		"error":   task.Error,
	})
}

// GetEmotionHistory 获取情绪历史
func (h *Handler) GetEmotionHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var histories []models.EmotionHistory
	var total int64

	h.DB.Model(&models.EmotionHistory{}).Count(&total)
	h.DB.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&histories)

	type HistoryDTO struct {
		ID        uint   `json:"id"`
		EmotionID uint8  `json:"emotion_id"`
		PhotoCID  string `json:"photo_cid"`
		MusicID   uint8  `json:"music_id"`
		MoodText  string `json:"mood_text"`
		TxHash    string `json:"tx_hash"`
		CreatedAt string `json:"created_at"` // RFC3339 string, never zero
	}

	dtos := make([]HistoryDTO, 0, len(histories))
	for _, h := range histories {
		ts := h.CreatedAt
		if ts.IsZero() {
			ts = time.Now()
		}
		dtos = append(dtos, HistoryDTO{
			ID:        h.ID,
			EmotionID: h.EmotionID,
			PhotoCID:  h.PhotoCID,
			MusicID:   h.MusicID,
			MoodText:  h.MoodText,
			TxHash:    h.TxHash,
			CreatedAt: ts.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"data":      dtos,
	})
}

// GetLatestEmotion 获取最新情绪状态
func (h *Handler) GetLatestEmotion(c *gin.Context) {
	var history models.EmotionHistory
	if err := h.DB.Order("created_at DESC").First(&history).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"emotion_id": 3,
			"photo_cid":  "",
			"music_id":   0,
			"mood_text":  "Hello World!",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"emotion_id": history.EmotionID,
		"photo_cid":  history.PhotoCID,
		"music_id":   history.MusicID,
		"mood_text":  history.MoodText,
	})
}

// SendComfort 粉丝发送安慰
func (h *Handler) SendComfort(c *gin.Context) {
	var req struct {
		WalletAddress string `json:"wallet_address" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record := models.ComfortRecord{
		WalletAddress: strings.ToLower(req.WalletAddress),
	}
	h.DB.Create(&record)

	c.JSON(http.StatusOK, gin.H{
		"message":   "Comfort sent!",
		"timestamp": time.Now().Unix(),
	})
}

// GetComfortCount 获取安慰总数
func (h *Handler) GetComfortCount(c *gin.Context) {
	var count int64
	h.DB.Model(&models.ComfortRecord{}).Count(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// HealthCheck 健康检查
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}
