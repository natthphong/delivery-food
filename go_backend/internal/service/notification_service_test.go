package service

import (
	"context"
	"strings"
	"testing"
	"time"

	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type mailerStub struct {
	messages []EmailMessage
}

func (m *mailerStub) Send(_ context.Context, message EmailMessage) error {
	m.messages = append(m.messages, message)
	return nil
}

type lineStub struct {
	to   []string
	text []string
}

func (l *lineStub) PushText(_ context.Context, to string, text string) error {
	l.to = append(l.to, to)
	l.text = append(l.text, text)
	return nil
}

func TestNotificationServiceSendVerificationEmail(t *testing.T) {
	email := "customer@example.com"
	mailer := &mailerStub{}
	service := &NotificationService{
		mailer:          mailer,
		line:            noopLineMessenger{},
		tokenManager:    backendauth.NewTokenManager("test-secret"),
		frontendOrigin:  "https://baanfoodie.test",
		verificationTTL: 24 * time.Hour,
	}

	err := service.SendVerificationEmail(context.Background(), model.User{
		ID:    7,
		Email: &email,
	}, "th")
	if err != nil {
		t.Fatalf("SendVerificationEmail() error = %v", err)
	}
	if len(mailer.messages) != 1 {
		t.Fatalf("expected 1 email, got %d", len(mailer.messages))
	}
	message := mailer.messages[0]
	if message.Subject != "ยืนยันอีเมลสำหรับ BaanFoodie" {
		t.Fatalf("Subject = %q", message.Subject)
	}
	if len(message.To) != 1 || message.To[0] != email {
		t.Fatalf("To = %v, want [%s]", message.To, email)
	}
	if !strings.Contains(message.Text, "https://baanfoodie.test/verify-email?token=") {
		t.Fatalf("Text = %q, want verification URL", message.Text)
	}
}

func TestNotificationServiceNotifyOrderPlacedForLineLinkedUser(t *testing.T) {
	email := "customer@example.com"
	mailer := &mailerStub{}
	line := &lineStub{}
	service := &NotificationService{
		mailer:        mailer,
		line:          line,
		emailNotifyTo: "ops@example.com",
	}

	branchName := "Siam"
	err := service.NotifyOrderPlaced(context.Background(), model.User{
		ID:           9,
		Email:        &email,
		AuthProvider: "line",
		AuthSubject:  "line-user-123",
	}, model.Order{
		ID:     55,
		Status: "PENDING",
		Branch: &model.BranchSummary{Name: branchName},
	})
	if err != nil {
		t.Fatalf("NotifyOrderPlaced() error = %v", err)
	}
	if len(mailer.messages) != 2 {
		t.Fatalf("expected 2 emails, got %d", len(mailer.messages))
	}
	if len(line.to) != 1 || line.to[0] != "line-user-123" {
		t.Fatalf("line targets = %v, want line-user-123", line.to)
	}
	if !strings.Contains(line.text[0], "คำสั่งซื้อ #55") {
		t.Fatalf("line text = %q, want order id", line.text[0])
	}
}
