package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"idol-capsule-backend/config"
	"idol-capsule-backend/handlers"
	"idol-capsule-backend/models"
	"idol-capsule-backend/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()

	// ========== 连接数据库 ==========
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}
	log.Println("[DB] Connected to MySQL")

	// 自动建表
	if err := models.AutoMigrate(db); err != nil {
		log.Fatalf("Failed to migrate: %v", err)
	}
	log.Println("[DB] Migration completed")

	// ========== 初始化服务 ==========
	pinata := &services.PinataService{JWT: cfg.PinataJWT}
	if len(cfg.PinataJWT) > 20 {
		log.Printf("[Config] Pinata JWT loaded: ...%s", cfg.PinataJWT[len(cfg.PinataJWT)-10:])
	} else {
		log.Println("[Config] WARNING: Pinata JWT is empty or too short!")
	}

	h := &handlers.Handler{
		DB:          db,
		Pinata:      pinata,
		JWTSecret:   cfg.JWTSecret,
		IdolAddress: cfg.IdolAddress,
	}

	// ========== 初始化链上调用器 ==========
	var chainCaller *services.ChainCaller
	if cfg.PrivateKey != "" && cfg.ContractAddress != "" && cfg.RPCURL != "" {
		var callerErr error
		chainCaller, callerErr = services.NewChainCaller(
			cfg.RPCURL,
			cfg.ContractAddress,
			cfg.PrivateKey,
			cfg.ChainID,
		)
		if callerErr != nil {
			log.Fatalf("[ChainCaller] Init failed: %v", callerErr)
		}
		log.Printf("[ChainCaller] Ready — contract %s on chain %d", cfg.ContractAddress, cfg.ChainID)
	} else {
		log.Println("[ChainCaller] WARNING: PRIVATE_KEY / CONTRACT_ADDRESS / RPC_URL not set — Worker will fail on real tasks")
	}

	// ========== 启动 Worker ==========
	ctx, cancel := context.WithCancel(context.Background())
	worker := services.NewWorker(db, chainCaller, 5*time.Second)
	go worker.Start(ctx)

	// ========== 启动链上事件监听 ==========
	if cfg.RPCURL != "" && cfg.ContractAddress != "" {
		listener := services.NewEventListener(db, cfg.RPCURL, cfg.ContractAddress)
		go listener.Start(ctx)
		log.Println("[EventListener] SuperComfortSent listener started")
	} else {
		log.Println("[EventListener] Skipped (RPC_URL or CONTRACT_ADDRESS not set)")
	}

	// ========== 路由配置 ==========
	r := gin.Default()

	// CORS 配置
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// API 路由组
	api := r.Group("/api/v1")
	{
		api.GET("/health", h.HealthCheck)

		// SIWE 认证
		api.POST("/auth/nonce", h.GetNonce)
		api.POST("/auth/verify", h.VerifySignature)
		api.GET("/auth/me", h.GetMe)

		// 偶像端
		api.POST("/emotion/update", h.SubmitEmotionUpdate)
		api.POST("/upload/photo", h.UploadPhoto)

		// 粉丝端
		api.GET("/emotion/latest", h.GetLatestEmotion)
		api.GET("/emotion/history", h.GetEmotionHistory)
		api.POST("/comfort", h.SendComfort)
		api.GET("/comfort/count", h.GetComfortCount)

		// 聚合统计 API
		api.GET("/comfort/heatmap", h.GetComfortHeatmap)
		api.GET("/comfort/top-fans", h.GetTopFans)
		api.GET("/comfort/my-count", h.GetMyComfortCount)
		api.GET("/comfort/today-free", h.CheckTodayFree)
		api.GET("/comfort/super", h.GetSuperComforts)
		api.GET("/emotion/radar", h.GetEmotionRadar)
		api.GET("/emotion/comfort-stats", h.GetEmotionComfortStats)

		// 任务查询
		api.GET("/task/:id", h.GetTaskStatus)
	}

	// ========== 启动 HTTP 服务 ==========
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: r,
	}

	go func() {
		log.Printf("[Server] Listening on :%s\n", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// ========== 优雅退出 ==========
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Server] Shutting down...")
	cancel()
	worker.Stop()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal("[Server] Forced shutdown:", err)
	}
	log.Println("[Server] Exited cleanly")
}
