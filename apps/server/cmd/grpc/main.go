package main

import (
	"log"

	"tutor-server/internal/app"
	"tutor-server/internal/config"
	grpcserver "tutor-server/internal/grpc"
)

func main() {
	cfg := config.Load()
	container, err := app.Build(cfg)
	if err != nil {
		log.Fatalf("build app container failed: %v", err)
	}
	defer container.Close()

	server := grpcserver.New(cfg, container)

	log.Printf("grpc server starting on :%s", cfg.GRPCPort)
	if err := server.Run(); err != nil {
		log.Fatalf("grpc server failed: %v", err)
	}
}
