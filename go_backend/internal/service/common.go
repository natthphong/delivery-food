package service

import (
	"context"
	"strconv"

	"github.com/natthaohong/delivery-food/go_backend/internal/apperror"
	"github.com/natthaohong/delivery-food/go_backend/internal/repository"
)

func loadConfigValues(ctx context.Context, store *repository.Store) (map[string]string, error) {
	items, err := store.ListSystemConfigs(ctx)
	if err != nil {
		return nil, apperror.Internal("failed to load system configuration", err)
	}
	values := make(map[string]string, len(items))
	for _, item := range items {
		values[item.Key] = item.Value
	}
	return values, nil
}

func configInt(values map[string]string, key string, fallback int) int {
	raw := values[key]
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return parsed
}
