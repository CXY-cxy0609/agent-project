package repository

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"

	"tutor-server/internal/infra/database"
)

type SQLUserRepository struct {
	db     *sql.DB
	driver string
}

func NewSQLUserRepository(store *database.Store) *SQLUserRepository {
	return &SQLUserRepository{
		db:     store.SQLDB(),
		driver: store.Driver(),
	}
}

func (r *SQLUserRepository) Create(ctx context.Context, user User) (User, error) {
	now := time.Now().UTC()

	query := `INSERT INTO users (username, phone, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`
	args := []any{user.Username, user.Phone, user.PasswordHash, user.Role, now, now}
	if r.driver == "pgx" {
		query = `INSERT INTO users (username, phone, password_hash, role, status, created_at, updated_at) VALUES ($1, $2, $3, $4, 1, $5, $6) RETURNING id`
	}

	var insertedID int64
	if r.driver == "pgx" {
		err := r.db.QueryRowContext(ctx, query, args...).Scan(&insertedID)
		if err != nil {
			if isUniqueViolation(err) {
				return User{}, ErrAlreadyExists
			}
			return User{}, err
		}
	} else {
		result, err := r.db.ExecContext(ctx, query, args...)
		if err != nil {
			if isUniqueViolation(err) {
				return User{}, ErrAlreadyExists
			}
			return User{}, err
		}
		insertedID, err = result.LastInsertId()
		if err != nil {
			return User{}, err
		}
	}

	user.ID = strconv.FormatInt(insertedID, 10)
	user.CreatedAt = now
	user.UpdatedAt = now
	return user, nil
}

func isUniqueViolation(err error) bool {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		return true
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}

	return false
}
