package objectstorage

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/tencentyun/cos-go-sdk-v5"
	"tutor-server/internal/config"
)

type TencentCOSClient struct {
	client        *cos.Client
	bucketBaseURL string
}

func NewTencentCOSClient(cfg config.ObjectStorageConfig) (*TencentCOSClient, error) {
	endpoint := strings.TrimSpace(cfg.Endpoint)
	if endpoint == "" {
		return nil, fmt.Errorf("object storage endpoint is required")
	}
	if strings.TrimSpace(cfg.SecretID) == "" || strings.TrimSpace(cfg.SecretKey) == "" {
		return nil, fmt.Errorf("tencent cos credentials are required")
	}

	u, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("invalid object storage endpoint: %w", err)
	}

	baseURL := &cos.BaseURL{BucketURL: u}
	transport := &cos.AuthorizationTransport{
		SecretID:     cfg.SecretID,
		SecretKey:    cfg.SecretKey,
		SessionToken: cfg.SessionToken,
	}
	client := cos.NewClient(baseURL, &http.Client{Transport: transport})
	return &TencentCOSClient{
		client:        client,
		bucketBaseURL: strings.TrimRight(endpoint, "/"),
	}, nil
}

func (c *TencentCOSClient) PutText(ctx context.Context, input PutTextInput) (PutObjectResult, error) {
	if c == nil || c.client == nil {
		return PutObjectResult{}, fmt.Errorf("tencent cos client is not initialized")
	}
	key := strings.TrimLeft(strings.TrimSpace(input.Key), "/")
	if key == "" {
		return PutObjectResult{}, fmt.Errorf("object key is required")
	}
	contentType := strings.TrimSpace(input.ContentType)
	if contentType == "" {
		contentType = "text/plain; charset=utf-8"
	}
	size := int64(len([]byte(input.Content)))
	body := strings.NewReader(input.Content)
	resp, err := c.client.Object.Put(ctx, key, body, &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: contentType,
		},
	})
	if err != nil {
		return PutObjectResult{}, err
	}
	return PutObjectResult{
		Key:  key,
		ETag: strings.Trim(resp.Header.Get("ETag"), "\""),
		Size: size,
		URL:  c.bucketBaseURL + "/" + key,
	}, nil
}
