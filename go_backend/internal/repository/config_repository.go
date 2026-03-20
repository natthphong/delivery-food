package repository

import (
	"context"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

func (s *Store) ListSystemConfigs(ctx context.Context) ([]model.SystemConfig, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT config_key, config_value, description
		FROM system_configs
		ORDER BY config_key
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	configs := make([]model.SystemConfig, 0)
	for rows.Next() {
		var item model.SystemConfig
		if err := rows.Scan(&item.Key, &item.Value, &item.Description); err != nil {
			return nil, err
		}
		configs = append(configs, item)
	}
	return configs, rows.Err()
}
