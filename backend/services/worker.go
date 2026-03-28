package services

import (
	"context"
	"log"
	"time"

	"idol-capsule-backend/models"

	"gorm.io/gorm"
)

// Worker 异步任务处理器 — 扫描 pending 任务并执行真实上链操作
type Worker struct {
	DB          *gorm.DB
	ChainCaller *ChainCaller // 真实合约调用器
	Interval    time.Duration
	StopCh      chan struct{}
}

func NewWorker(db *gorm.DB, caller *ChainCaller, interval time.Duration) *Worker {
	return &Worker{
		DB:          db,
		ChainCaller: caller,
		Interval:    interval,
		StopCh:      make(chan struct{}),
	}
}

// Start 启动 Worker 协程
func (w *Worker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.Interval)
	defer ticker.Stop()

	log.Println("[Worker] Started, scanning every", w.Interval)

	for {
		select {
		case <-ticker.C:
			w.processPendingTasks(ctx)
		case <-ctx.Done():
			log.Println("[Worker] Shutting down gracefully...")
			return
		case <-w.StopCh:
			log.Println("[Worker] Stop signal received")
			return
		}
	}
}

// processPendingTasks 处理待执行任务
func (w *Worker) processPendingTasks(ctx context.Context) {
	var tasks []models.Task
	result := w.DB.Where("status = ? AND retry_count < ?", "pending", 5).
		Order("created_at ASC").
		Limit(10).
		Find(&tasks)

	if result.Error != nil {
		log.Println("[Worker] Query error:", result.Error)
		return
	}

	for _, task := range tasks {
		w.processTask(ctx, &task)
	}
}

// processTask 真实上链：调用合约 updateIdolState，等待 Receipt
func (w *Worker) processTask(ctx context.Context, task *models.Task) {
	log.Printf("[Worker] Processing task #%d (emotion=%d, photo=%s)\n",
		task.ID, task.EmotionID, task.PhotoCID)

	// 标记为处理中
	w.DB.Model(task).Update("status", "processing")

	// 调用真实合约
	if w.ChainCaller == nil {
		log.Printf("[Worker] Task #%d skipped: ChainCaller not initialized (check PRIVATE_KEY/RPC_URL)\n", task.ID)
		w.DB.Model(task).Updates(map[string]interface{}{
			"status": "failed",
			"error":  "ChainCaller not configured",
		})
		return
	}

	txHash, err := w.ChainCaller.UpdateIdolState(
		ctx,
		task.EmotionID,
		task.PhotoCID,
		task.MusicID,
		task.MoodText,
		task.Deadline,
		task.Signature,
	)

	if err != nil {
		log.Printf("[Worker] Task #%d chain call failed: %v\n", task.ID, err)
		w.DB.Model(task).Updates(map[string]interface{}{
			"status":      "failed",
			"error":       err.Error(),
			"retry_count": task.RetryCount + 1,
		})
		// 如果还有重试次数，重置为 pending 等待下次 tick
		if task.RetryCount+1 < 5 {
			w.DB.Model(task).Updates(map[string]interface{}{
				"status": "pending",
			})
		}
		return
	}

	// 上链成功：更新任务状态
	w.DB.Model(task).Updates(map[string]interface{}{
		"status":  "success",
		"tx_hash": txHash,
	})

	// 写入情绪历史记录
	history := models.EmotionHistory{
		EmotionID: task.EmotionID,
		PhotoCID:  task.PhotoCID,
		MusicID:   task.MusicID,
		MoodText:  task.MoodText,
		TxHash:    txHash,
	}
	if err := w.DB.Create(&history).Error; err != nil {
		log.Printf("[Worker] Task #%d history insert error: %v\n", task.ID, err)
	}

	log.Printf("[Worker] Task #%d confirmed on-chain: %s\n", task.ID, txHash)
}

func (w *Worker) Stop() {
	close(w.StopCh)
}
