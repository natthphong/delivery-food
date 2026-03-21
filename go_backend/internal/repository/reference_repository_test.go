package repository

import (
	"testing"
	"time"
)

func TestFormatBusinessReference(t *testing.T) {
	refDate := time.Date(2026, 3, 21, 10, 30, 0, 0, time.UTC)

	if got := formatBusinessReference("OD", refDate, 1); got != "OD260321000001" {
		t.Fatalf("formatBusinessReference(order) = %s", got)
	}
	if got := formatBusinessReference("TX", refDate, 42); got != "TX260321000042" {
		t.Fatalf("formatBusinessReference(transaction) = %s", got)
	}
}
