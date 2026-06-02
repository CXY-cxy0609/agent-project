package objectstorage

import (
	"context"
)

type PutTextInput struct {
	Key         string
	Content     string
	ContentType string
}

type PutBytesInput struct {
	Key         string
	Data        []byte
	ContentType string
}

type PutObjectResult struct {
	Key   string
	ETag  string
	Size  int64
	URL   string
	Extra map[string]string
}

type Client interface {
	PutText(ctx context.Context, input PutTextInput) (PutObjectResult, error)
	PutBytes(ctx context.Context, input PutBytesInput) (PutObjectResult, error)
}
