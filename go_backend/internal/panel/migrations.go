package panel

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MigrationEngine struct {
	db *pgxpool.Pool
}

func (m *MigrationEngine) RunMigrations(ctx context.Context, sqlDir string) error {
	entries, err := os.ReadDir(sqlDir)
	if err != nil {
		return err
	}

	files := make([]string, 0)
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".sql") {
			continue
		}
		if strings.Contains(strings.ToLower(name), "seed") {
			continue
		}
		files = append(files, filepath.Join(sqlDir, name))
	}
	sort.Strings(files)

	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		if _, err := m.db.Exec(ctx, string(content)); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "42710" {
				// duplicate_object (e.g. re-adding existing constraint) is safe to ignore for idempotent startup migration
				continue
			}
			return fmt.Errorf("migration failed for %s: %w", file, err)
		}
	}
	return nil
}

func (m *MigrationEngine) SeedIfEmpty(ctx context.Context) error {
	var count int
	if err := m.db.QueryRow(ctx, `SELECT COUNT(*) FROM projects`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := m.db.Exec(ctx, defaultSeedSQL)
	return err
}
