package service

import (
	"testing"
	"time"

	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

func TestNormalizeTransactionSummaryMarksExpiredPayments(t *testing.T) {
	expiredAt := time.Now().Add(-5 * time.Minute)
	summary := normalizeTransactionSummary(model.TransactionSummary{
		Transaction: model.Transaction{
			Status:         "pending",
			ExpiresAt:      &expiredAt,
			ProviderStatus: nil,
		},
	})

	if !summary.IsExpired {
		t.Fatal("IsExpired = false, want true")
	}
	if summary.Status != "expired" {
		t.Fatalf("Status = %q, want expired", summary.Status)
	}
	if summary.ProviderStatus == nil || *summary.ProviderStatus != "expired" {
		t.Fatalf("ProviderStatus = %v, want expired", summary.ProviderStatus)
	}
}

func TestPersistedGatewayStatusKeepsExpiredAsPendingForStorage(t *testing.T) {
	if got := persistedGatewayStatus("expired"); got != "pending" {
		t.Fatalf("persistedGatewayStatus(expired) = %q, want pending", got)
	}
	if got := persistedGatewayStatus("accepted"); got != "accepted" {
		t.Fatalf("persistedGatewayStatus(accepted) = %q, want accepted", got)
	}
}
