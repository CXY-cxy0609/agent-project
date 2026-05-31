package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"

	"tutor-server/internal/config"
)

type Store struct {
	db     *sql.DB
	driver string
}

func New(cfg config.DBConfig) (*Store, error) {
	driver := normalizeDriver(cfg.Driver)
	dsn, err := resolveDSN(cfg, driver)
	if err != nil {
		return nil, err
	}

	db, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open db failed: %w", err)
	}

	db.SetMaxOpenConns(30)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	return &Store{db: db, driver: driver}, nil
}

func (s *Store) Check(ctx context.Context) error {
	if s == nil || s.db == nil {
		return fmt.Errorf("db store is nil")
	}
	return s.db.PingContext(ctx)
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) SQLDB() *sql.DB {
	if s == nil {
		return nil
	}
	return s.db
}

func (s *Store) Driver() string {
	if s == nil {
		return ""
	}
	return s.driver
}

func normalizeDriver(driver string) string {
	switch driver {
	case "postgres", "postgresql":
		return "pgx"
	default:
		return "mysql"
	}
}

func resolveDSN(cfg config.DBConfig, driver string) (string, error) {
	if cfg.DSN != "" {
		return cfg.DSN, nil
	}

	switch driver {
	case "pgx":
		return fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			cfg.Host,
			cfg.Port,
			cfg.User,
			cfg.Password,
			cfg.Name,
		), nil
	case "mysql":
		return fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=Local",
			cfg.User,
			cfg.Password,
			cfg.Host,
			cfg.Port,
			cfg.Name,
		), nil
	default:
		return "", fmt.Errorf("unsupported driver: %s", driver)
	}
}
