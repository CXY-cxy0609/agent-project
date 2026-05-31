package app

import "tutor-server/internal/infra/database"

func ensureRuntimeSchema(store *database.Store) error {
	if store == nil || store.SQLDB() == nil {
		return nil
	}
	queries := []string{
		`CREATE TABLE IF NOT EXISTS subject_outlines (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			subject_id BIGINT UNSIGNED NOT NULL,
			outline_json JSON NOT NULL,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY uk_subject_outlines_subject_id (subject_id),
			CONSTRAINT fk_subject_outlines_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS knowledge_bases (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			knowledge_base_id VARCHAR(80) NOT NULL,
			name VARCHAR(255) NOT NULL,
			subject_id BIGINT UNSIGNED DEFAULT NULL,
			type VARCHAR(32) NOT NULL DEFAULT 'custom',
			user_id BIGINT UNSIGNED DEFAULT NULL,
			description VARCHAR(255) DEFAULT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY uk_knowledge_bases_id (knowledge_base_id),
			KEY idx_knowledge_bases_subject_id (subject_id),
			KEY idx_knowledge_bases_user_id (user_id),
			CONSTRAINT fk_knowledge_bases_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
			CONSTRAINT fk_knowledge_bases_user_id FOREIGN KEY (user_id) REFERENCES users(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS knowledge_files (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			file_id VARCHAR(80) NOT NULL,
			knowledge_base_id VARCHAR(80) NOT NULL,
			name VARCHAR(255) NOT NULL,
			display_name VARCHAR(255) NOT NULL,
			type VARCHAR(16) NOT NULL DEFAULT 'md',
			url VARCHAR(512) DEFAULT '',
			size BIGINT NOT NULL DEFAULT 0,
			file_order INT NOT NULL DEFAULT 1,
			content MEDIUMTEXT,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY uk_knowledge_files_id (file_id),
			KEY idx_knowledge_files_base_order (knowledge_base_id, file_order),
			CONSTRAINT fk_knowledge_files_base_id FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(knowledge_base_id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS analytics_summaries (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			subject_id BIGINT UNSIGNED NOT NULL,
			summary TEXT NOT NULL,
			summary_generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY uk_analytics_user_subject (user_id, subject_id),
			KEY idx_analytics_subject (subject_id),
			CONSTRAINT fk_analytics_user_id FOREIGN KEY (user_id) REFERENCES users(id),
			CONSTRAINT fk_analytics_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
	for _, q := range queries {
		if _, err := store.SQLDB().Exec(q); err != nil {
			return err
		}
	}
	return nil
}
