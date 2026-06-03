package repository

import (
	"context"
	"database/sql"

	"tutor-server/internal/domain"
	"tutor-server/internal/infra/database"
)

type SQLSubjectRepository struct {
	db *sql.DB
}

func NewSQLSubjectRepository(store *database.Store) *SQLSubjectRepository {
	return &SQLSubjectRepository{db: store.SQLDB()}
}

func (r *SQLSubjectRepository) List(ctx context.Context) ([]domain.Subject, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, name, education_stage FROM subjects ORDER BY id DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.Subject, 0, 16)
	for rows.Next() {
		var s domain.Subject
		if err := rows.Scan(&s.ID, &s.Name, &s.EducationStage); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}
