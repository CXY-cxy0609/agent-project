package handlers

import (
	"log"
	"strings"
	"sync"

	"tutor-server/internal/config"
	"tutor-server/internal/infra/objectstorage"
)

type messageStoragePolicy struct {
	enabled             bool
	inlineMaxBytes      int
	externalizeMinBytes int
	pathPrefix          string
}

var objectStorageRuntime struct {
	mu     sync.RWMutex
	client objectstorage.Client
	policy messageStoragePolicy
}

func UseObjectStorage(cfg config.ObjectStorageConfig) {
	policy := messageStoragePolicy{
		enabled:             cfg.Enabled,
		inlineMaxBytes:      cfg.InlineMaxBytes,
		externalizeMinBytes: cfg.ExternalizeMinBytes,
		pathPrefix:          strings.Trim(strings.TrimSpace(cfg.PathPrefix), "/"),
	}
	if policy.inlineMaxBytes <= 0 {
		policy.inlineMaxBytes = 8192
	}
	if policy.externalizeMinBytes <= 0 {
		policy.externalizeMinBytes = 12288
	}
	if policy.pathPrefix == "" {
		policy.pathPrefix = "chat"
	}

	var client objectstorage.Client
	if policy.enabled {
		provider := strings.ToLower(strings.TrimSpace(cfg.Provider))
		switch provider {
		case "", "tencent-cos":
			cosClient, err := objectstorage.NewTencentCOSClient(cfg)
			if err != nil {
				log.Printf("object storage disabled due to init error: %v", err)
				policy.enabled = false
			} else {
				client = cosClient
			}
		default:
			log.Printf("unsupported object storage provider %q, object storage disabled", cfg.Provider)
			policy.enabled = false
		}
	}

	objectStorageRuntime.mu.Lock()
	objectStorageRuntime.client = client
	objectStorageRuntime.policy = policy
	objectStorageRuntime.mu.Unlock()
}

func getObjectStorageRuntime() (objectstorage.Client, messageStoragePolicy) {
	objectStorageRuntime.mu.RLock()
	defer objectStorageRuntime.mu.RUnlock()
	return objectStorageRuntime.client, objectStorageRuntime.policy
}
