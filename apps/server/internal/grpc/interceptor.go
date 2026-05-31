package grpcserver

import (
	"context"
	"log"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

func unaryAccessLogInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()
	resp, err := handler(ctx, req)
	durationMs := time.Since(start).Milliseconds()
	reqID := requestIDFromMD(ctx)
	if err != nil {
		log.Printf("grpc request_id=%s method=%s duration_ms=%d error=%v", reqID, info.FullMethod, durationMs, err)
		return resp, err
	}
	log.Printf("grpc request_id=%s method=%s duration_ms=%d status=ok", reqID, info.FullMethod, durationMs)
	return resp, nil
}

func requestIDFromMD(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	if vals := md.Get("x-request-id"); len(vals) > 0 {
		return vals[0]
	}
	if vals := md.Get("x-trace-id"); len(vals) > 0 {
		return vals[0]
	}
	return ""
}
