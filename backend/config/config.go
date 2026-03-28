package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// loadDotEnv reads a .env file and sets any missing environment variables.
// It is intentionally lenient: missing file or parse errors are silently skipped.
func loadDotEnv(filename string) {
	// Try cwd first, then next to the running binary
	candidates := []string{filename}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), filename))
	}
	var f *os.File
	for _, path := range candidates {
		var err error
		f, err = os.Open(path)
		if err == nil {
			break
		}
	}
	if f == nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Only set if not already set in the real environment
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	ServerPort string

	PinataJWT       string
	PinataAPIKey    string
	PinataAPISecret string

	PrivateKey      string
	ContractAddress string
	RPCURL          string
	ChainID         int64

	JWTSecret   string
	IdolAddress string
}

func Load() *Config {
	loadDotEnv(".env")

	return &Config{
		DBHost:     getEnv("DB_HOST", "127.0.0.1"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBUser:     getEnv("DB_USER", "root"),
		DBPassword: getEnv("DB_PASSWORD", "123456"),
		DBName:     getEnv("DB_NAME", "idol_capsule"),
		ServerPort: getEnv("SERVER_PORT", "8080"),

		PinataJWT:       getEnv("PINATA_JWT", ""),
		PinataAPIKey:    getEnv("PINATA_API_KEY", ""),
		PinataAPISecret: getEnv("PINATA_API_SECRET", ""),

		PrivateKey:      getEnv("PRIVATE_KEY", ""),
		ContractAddress: getEnv("CONTRACT_ADDRESS", ""),
		RPCURL:          getEnv("RPC_URL", "https://rpc.sepolia.org"),
		ChainID:         11155111, // Sepolia

		JWTSecret:   getEnv("JWT_SECRET", "idol-capsule-secret-change-in-prod"),
		IdolAddress: getEnv("IDOL_ADDRESS", "0xcdD5a068B11F9c653F98363fa2739e7f1255b791"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
