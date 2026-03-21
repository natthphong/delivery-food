package repository

import (
	"context"
	"fmt"
	"strings"
	"time"
)

var businessReferenceLocation = time.FixedZone("Asia/Bangkok", 7*60*60)

func formatBusinessReference(refType string, refDate time.Time, sequence int64) string {
	datePart := refDate.In(businessReferenceLocation).Format("060102")
	return fmt.Sprintf("%s%s%06d", strings.TrimSpace(refType), datePart, sequence)
}

func (s *Store) AllocateBusinessReference(ctx context.Context, tx DBTX, refType string, now time.Time) (string, error) {
	refType = strings.TrimSpace(strings.ToUpper(refType))
	refDate := now.In(businessReferenceLocation)
	var sequence int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO business_reference_counters (ref_type, ref_date, last_value)
		VALUES ($1, $2, 1)
		ON CONFLICT (ref_type, ref_date)
		DO UPDATE SET
			last_value = business_reference_counters.last_value + 1,
			updated_at = NOW()
		RETURNING last_value
	`, refType, refDate).Scan(&sequence); err != nil {
		return "", err
	}
	return formatBusinessReference(refType, refDate, sequence), nil
}
