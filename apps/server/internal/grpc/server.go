package grpcserver

import (
	"fmt"
	"net"

	"google.golang.org/grpc"
	grpcHealth "google.golang.org/grpc/health"
	healthv1 "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	taskv1 "tutor-server/api/gen/task/v1"
	"tutor-server/internal/app"
	"tutor-server/internal/config"
)

type Server struct {
	cfg       config.Config
	container *app.Container
}

func New(cfg config.Config, container *app.Container) *Server {
	return &Server{
		cfg:       cfg,
		container: container,
	}
}

func (s *Server) Run() error {
	addr := fmt.Sprintf(":%s", s.cfg.GRPCPort)
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen grpc failed: %w", err)
	}

	grpcSrv := grpc.NewServer(
		grpc.UnaryInterceptor(unaryAccessLogInterceptor),
	)
	taskv1.RegisterTaskServiceServer(grpcSrv, NewTaskRPCService(s.container.TaskService))
	healthServer := grpcHealth.NewServer()
	healthServer.SetServingStatus("tutor.server.internal.v1.TaskService", healthv1.HealthCheckResponse_SERVING)
	healthv1.RegisterHealthServer(grpcSrv, healthServer)
	reflection.Register(grpcSrv)
	return grpcSrv.Serve(lis)
}
