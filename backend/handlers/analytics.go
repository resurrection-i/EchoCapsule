package handlers

import (
	"log"
	"net/http"
	"strings"
	"time"

	"idol-capsule-backend/models"

	"github.com/gin-gonic/gin"
)

// ========== 聚合统计 API（热力图 / 雷达图 / 排行榜） ==========

// HeatmapDay 热力图单日数据
type HeatmapDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// GetComfortHeatmap 粉丝个人安慰热力图（近 365 天）
// GET /comfort/heatmap?address=0x...
func (h *Handler) GetComfortHeatmap(c *gin.Context) {
	addr := strings.ToLower(c.Query("address"))
	if addr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}

	since := time.Now().AddDate(-1, 0, 0) // 近一年

	var results []struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}

	// Use DATE_FORMAT so result is always "YYYY-MM-DD" string, no timezone ambiguity
	h.DB.Model(&models.ComfortRecord{}).
		Select("DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count").
		Where("LOWER(wallet_address) = ? AND created_at >= ?", addr, since).
		Group("DATE_FORMAT(created_at, '%Y-%m-%d')").
		Order("date ASC").
		Scan(&results)

	log.Printf("[Heatmap] addr=%s rows=%d", addr, len(results))

	days := make([]HeatmapDay, 0, len(results))
	for _, r := range results {
		days = append(days, HeatmapDay{Date: r.Date, Count: r.Count})
	}

	c.JSON(http.StatusOK, gin.H{"data": days})
}

// TopFan 铁粉排行榜条目
type TopFan struct {
	Address string `json:"address"`
	Count   int64  `json:"count"`
}

// GetTopFans 铁粉排行榜 Top N
// GET /comfort/top-fans?limit=3
func (h *Handler) GetTopFans(c *gin.Context) {
	limit := 3

	var fans []TopFan

	h.DB.Model(&models.ComfortRecord{}).
		Select("wallet_address as address, COUNT(*) as count").
		Group("wallet_address").
		Order("count DESC").
		Limit(limit).
		Scan(&fans)

	c.JSON(http.StatusOK, gin.H{"data": fans})
}

// EmotionStat 情绪分布统计条目
type EmotionStat struct {
	EmotionID int   `json:"emotion_id"`
	Count     int64 `json:"count"`
}

// GetEmotionRadar 情绪分布雷达图数据
// GET /emotion/radar
func (h *Handler) GetEmotionRadar(c *gin.Context) {
	var stats []EmotionStat

	h.DB.Model(&models.EmotionHistory{}).
		Select("emotion_id, COUNT(*) as count").
		Group("emotion_id").
		Order("emotion_id ASC").
		Scan(&stats)

	// 补齐 0-4 所有情绪 ID
	full := make([]EmotionStat, 5)
	for i := range full {
		full[i] = EmotionStat{EmotionID: i, Count: 0}
	}
	for _, s := range stats {
		if s.EmotionID >= 0 && s.EmotionID < 5 {
			full[s.EmotionID].Count = s.Count
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": full})
}

// GetMyComfortCount 某个粉丝的个人安慰次数
// GET /comfort/my-count?address=0x...
func (h *Handler) GetMyComfortCount(c *gin.Context) {
	addr := strings.ToLower(c.Query("address"))
	if addr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address is required"})
		return
	}

	var count int64
	h.DB.Model(&models.ComfortRecord{}).Where("wallet_address = ?", addr).Count(&count)

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// GetEmotionComfortStats 每条历史情绪对应收到的安慰数（互动战报）
// GET /emotion/comfort-stats
func (h *Handler) GetEmotionComfortStats(c *gin.Context) {
	// 按情绪历史记录的创建时间区间来统计安慰数
	var histories []models.EmotionHistory
	h.DB.Order("created_at ASC").Find(&histories)

	type StatItem struct {
		HistoryID    uint  `json:"history_id"`
		ComfortCount int64 `json:"comfort_count"`
	}

	result := make([]StatItem, 0, len(histories))

	for i, hist := range histories {
		start := hist.CreatedAt
		var end time.Time
		if i+1 < len(histories) {
			end = histories[i+1].CreatedAt
		} else {
			end = time.Now()
		}

		var count int64
		h.DB.Model(&models.ComfortRecord{}).
			Where("created_at >= ? AND created_at < ?", start, end).
			Count(&count)

		result = append(result, StatItem{HistoryID: hist.ID, ComfortCount: count})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
