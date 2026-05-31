package handlers

import (
	"database/sql"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/infra/database"
	"tutor-server/internal/http/response"
)

var dbRuntime struct {
	mu     sync.RWMutex
	db     *sql.DB
	driver string
}

func UseDBStore(store *database.Store) {
	dbRuntime.mu.Lock()
	defer dbRuntime.mu.Unlock()
	if store == nil {
		dbRuntime.db = nil
		dbRuntime.driver = ""
		return
	}
	dbRuntime.db = store.SQLDB()
	dbRuntime.driver = store.Driver()
}

func dbOrError(c *gin.Context) (*sql.DB, string, bool) {
	dbRuntime.mu.RLock()
	db := dbRuntime.db
	driver := dbRuntime.driver
	dbRuntime.mu.RUnlock()
	if db == nil {
		response.Error(c, http.StatusServiceUnavailable, "DB_UNAVAILABLE", "database is unavailable")
		return nil, "", false
	}
	return db, driver, true
}
