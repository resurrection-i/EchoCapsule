package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户表 — 偶像或粉丝
type User struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	WalletAddress string `gorm:"uniqueIndex;size:42;not null" json:"wallet_address"`
	Role          string `gorm:"size:10;not null;default:fan" json:"role"` // idol / fan
	Nonce         string `gorm:"size:64;default:''" json:"nonce"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Task 异步任务表 — 情绪更新任务队列
type Task struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	TokenID    uint64 `json:"token_id"`
	EmotionID  uint8  `json:"emotion_id"`
	PhotoCID   string `gorm:"size:256" json:"photo_cid"`
	MusicID    uint8  `json:"music_id"`
	MoodText   string `gorm:"size:500" json:"mood_text"`
	Signature  string `gorm:"type:text" json:"signature"`
	Deadline   uint64 `json:"deadline"`
	Status     string `gorm:"size:20;default:pending;index" json:"status"` // pending / processing / success / failed
	RetryCount int    `gorm:"default:0" json:"retry_count"`
	TxHash     string `gorm:"size:66" json:"tx_hash"`
	Error      string `gorm:"type:text" json:"error"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// EmotionHistory 情绪历史记录
type EmotionHistory struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	EmotionID uint8  `json:"emotion_id"`
	PhotoCID  string `gorm:"size:256" json:"photo_cid"`
	MusicID   uint8  `json:"music_id"`
	MoodText  string `gorm:"size:500" json:"mood_text"`
	TxHash    string `gorm:"size:66" json:"tx_hash"`
	CreatedAt time.Time
}

// ComfortRecord 粉丝安慰记录
type ComfortRecord struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	WalletAddress string `gorm:"size:42;index" json:"wallet_address"`
	CreatedAt     time.Time
}

// SuperComfort 付费深度共鸣记录（链上事件同步）
type SuperComfort struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	WalletAddress string `gorm:"size:42;index" json:"wallet_address"`
	Message       string `gorm:"size:500" json:"message"`
	Amount        string `gorm:"size:30" json:"amount"` // wei as string
	TxHash        string `gorm:"size:66;uniqueIndex" json:"tx_hash"`
	BlockNumber   uint64 `json:"block_number"`
	CreatedAt     time.Time
}

// AutoMigrate 自动建表
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&User{}, &Task{}, &EmotionHistory{}, &ComfortRecord{}, &SuperComfort{})
}
