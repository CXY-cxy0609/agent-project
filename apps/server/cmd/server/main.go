package main

import (
	"fmt"
	"log"

	"tutor-server/internal/app"
	"tutor-server/internal/config"
	httpserver "tutor-server/internal/http"
)

func main() {
	cfg := config.Load()

	container, err := app.Build(cfg)
	if err != nil {
		log.Fatalf("build app container failed: %v", err)
	}
	defer container.Close()

	router := httpserver.NewRouter(cfg, container)
	addr := fmt.Sprintf(":%s", cfg.Port)

	log.Printf("server starting on http://localhost:%s/api", cfg.Port)
	if err := router.Run(addr); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}
