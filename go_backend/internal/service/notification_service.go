package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	backendauth "github.com/natthaohong/delivery-food/go_backend/internal/auth"
	"github.com/natthaohong/delivery-food/go_backend/internal/config"
	"github.com/natthaohong/delivery-food/go_backend/internal/model"
)

type EmailMessage struct {
	To      []string
	Subject string
	HTML    string
	Text    string
}

type Mailer interface {
	Send(ctx context.Context, message EmailMessage) error
}

type LineMessenger interface {
	PushText(ctx context.Context, to string, text string) error
}

type noopMailer struct{}

func (noopMailer) Send(context.Context, EmailMessage) error { return nil }

type noopLineMessenger struct{}

func (noopLineMessenger) PushText(context.Context, string, string) error { return nil }

type ResendMailer struct {
	client *http.Client
	apiKey string
	from   string
}

func (m *ResendMailer) Send(ctx context.Context, message EmailMessage) error {
	if strings.TrimSpace(m.apiKey) == "" || len(message.To) == 0 {
		return nil
	}
	payload := map[string]any{
		"from":    m.from,
		"to":      message.To,
		"subject": message.Subject,
		"html":    message.HTML,
		"text":    message.Text,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+m.apiKey)
	request.Header.Set("Content-Type", "application/json")
	response, err := m.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 {
		return fmt.Errorf("resend returned status %d", response.StatusCode)
	}
	return nil
}

type LineBotClient struct {
	client       *http.Client
	channelToken string
}

func (m *LineBotClient) PushText(ctx context.Context, to string, text string) error {
	if strings.TrimSpace(m.channelToken) == "" || strings.TrimSpace(to) == "" || strings.TrimSpace(text) == "" {
		return nil
	}
	payload := map[string]any{
		"to": to,
		"messages": []map[string]string{
			{
				"type": "text",
				"text": text,
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.line.me/v2/bot/message/push", bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+m.channelToken)
	request.Header.Set("Content-Type", "application/json")
	response, err := m.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 {
		return fmt.Errorf("line messaging returned status %d", response.StatusCode)
	}
	return nil
}

type NotificationService struct {
	mailer          Mailer
	line            LineMessenger
	tokenManager    *backendauth.TokenManager
	frontendOrigin  string
	emailNotifyTo   string
	verificationTTL time.Duration
}

func NewNotificationService(cfg config.Config, tokenManager *backendauth.TokenManager) *NotificationService {
	client := &http.Client{Timeout: cfg.HTTPClientTimeout}
	var mailer Mailer = noopMailer{}
	if strings.TrimSpace(cfg.ResendAPIKey) != "" {
		mailer = &ResendMailer{
			client: client,
			apiKey: strings.TrimSpace(cfg.ResendAPIKey),
			from:   strings.TrimSpace(cfg.EmailFrom),
		}
	}
	var line LineMessenger = noopLineMessenger{}
	if strings.TrimSpace(cfg.LineChannelToken) != "" {
		line = &LineBotClient{
			client:       client,
			channelToken: strings.TrimSpace(cfg.LineChannelToken),
		}
	}
	return &NotificationService{
		mailer:          mailer,
		line:            line,
		tokenManager:    tokenManager,
		frontendOrigin:  strings.TrimRight(strings.TrimSpace(cfg.FrontendOrigin), "/"),
		emailNotifyTo:   strings.TrimSpace(cfg.EmailNotifyTo),
		verificationTTL: 24 * time.Hour,
	}
}

func (s *NotificationService) SendVerificationEmail(ctx context.Context, user model.User, locale string) error {
	if s == nil || s.tokenManager == nil || user.Email == nil || strings.TrimSpace(*user.Email) == "" {
		return nil
	}
	token, err := s.tokenManager.SignEmailVerificationToken(user.ID, strings.TrimSpace(*user.Email), s.verificationTTL)
	if err != nil {
		return err
	}
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.frontendOrigin, url.QueryEscape(token))
	subject := "Verify your email for BaanFoodie"
	text := fmt.Sprintf("Please verify your email address by opening this link: %s", verifyURL)
	html := fmt.Sprintf(`<p>Please verify your email address for BaanFoodie.</p><p><a href="%s">Verify email</a></p><p>If you did not request this, you can ignore this message.</p>`, verifyURL)
	if strings.EqualFold(strings.TrimSpace(locale), "th") {
		subject = "ยืนยันอีเมลสำหรับ BaanFoodie"
		text = fmt.Sprintf("กรุณายืนยันอีเมลของคุณผ่านลิงก์นี้: %s", verifyURL)
		html = fmt.Sprintf(`<p>กรุณายืนยันอีเมลของคุณสำหรับ BaanFoodie</p><p><a href="%s">ยืนยันอีเมล</a></p><p>หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลฉบับนี้ได้</p>`, verifyURL)
	}
	return s.mailer.Send(ctx, EmailMessage{
		To:      []string{strings.TrimSpace(*user.Email)},
		Subject: subject,
		Text:    text,
		HTML:    html,
	})
}

func (s *NotificationService) SendProviderLoginEmail(ctx context.Context, user model.User) error {
	if s == nil || user.Email == nil || strings.TrimSpace(*user.Email) == "" {
		return nil
	}
	subject := "Sign-in notice"
	text := fmt.Sprintf("A sign-in to your BaanFoodie account was completed with %s on %s.", defaultString(stringValue(user.ProviderLabel), user.AuthProvider), time.Now().Format(time.RFC1123))
	html := fmt.Sprintf(`<p>A sign-in to your BaanFoodie account was completed with %s.</p><p>Time: %s</p>`, defaultString(stringValue(user.ProviderLabel), user.AuthProvider), time.Now().Format(time.RFC1123))
	return s.mailer.Send(ctx, EmailMessage{
		To:      []string{strings.TrimSpace(*user.Email)},
		Subject: subject,
		Text:    text,
		HTML:    html,
	})
}

func (s *NotificationService) NotifyOrderPlaced(ctx context.Context, user model.User, order model.Order) error {
	if s == nil {
		return nil
	}
	branchName := "-"
	if order.Branch != nil && strings.TrimSpace(order.Branch.Name) != "" {
		branchName = order.Branch.Name
	}
	if user.Email != nil && strings.TrimSpace(*user.Email) != "" {
		if err := s.mailer.Send(ctx, EmailMessage{
			To:      []string{strings.TrimSpace(*user.Email)},
			Subject: fmt.Sprintf("Order #%d received", order.ID),
			Text:    fmt.Sprintf("Your order #%d for %s has been received. Current status: %s.", order.ID, branchName, order.Status),
			HTML:    fmt.Sprintf(`<p>Your order <strong>#%d</strong> for %s has been received.</p><p>Status: %s</p>`, order.ID, branchName, order.Status),
		}); err != nil {
			return err
		}
	}
	if strings.TrimSpace(s.emailNotifyTo) != "" {
		if err := s.mailer.Send(ctx, EmailMessage{
			To:      []string{strings.TrimSpace(s.emailNotifyTo)},
			Subject: fmt.Sprintf("New order #%d", order.ID),
			Text:    fmt.Sprintf("New order #%d was placed for branch %s.", order.ID, branchName),
			HTML:    fmt.Sprintf(`<p>New order <strong>#%d</strong> was placed for branch %s.</p>`, order.ID, branchName),
		}); err != nil {
			return err
		}
	}
	return s.pushLine(ctx, user, fmt.Sprintf("รับคำสั่งซื้อ #%d แล้ว สาขา %s สถานะปัจจุบัน: %s", order.ID, branchName, order.Status))
}

func (s *NotificationService) NotifyOrderReady(ctx context.Context, user model.User, order model.Order) error {
	if s == nil {
		return nil
	}
	message := fmt.Sprintf("คำสั่งซื้อ #%d พร้อมแล้ว", order.ID)
	if user.Email != nil && strings.TrimSpace(*user.Email) != "" {
		if err := s.mailer.Send(ctx, EmailMessage{
			To:      []string{strings.TrimSpace(*user.Email)},
			Subject: fmt.Sprintf("Order #%d is ready", order.ID),
			Text:    fmt.Sprintf("Order #%d is ready for pickup or completion.", order.ID),
			HTML:    fmt.Sprintf(`<p>Order <strong>#%d</strong> is ready.</p>`, order.ID),
		}); err != nil {
			return err
		}
	}
	return s.pushLine(ctx, user, message)
}

func (s *NotificationService) NotifyRiderAssigned(ctx context.Context, user model.User, order model.Order) error {
	if s == nil {
		return nil
	}
	riderName := "rider"
	if order.DeliveryJob != nil && order.DeliveryJob.AssignedRiderName != nil && strings.TrimSpace(*order.DeliveryJob.AssignedRiderName) != "" {
		riderName = strings.TrimSpace(*order.DeliveryJob.AssignedRiderName)
	}
	message := fmt.Sprintf("คำสั่งซื้อ #%d มีไรเดอร์รับงานแล้ว: %s", order.ID, riderName)
	if user.Email != nil && strings.TrimSpace(*user.Email) != "" {
		if err := s.mailer.Send(ctx, EmailMessage{
			To:      []string{strings.TrimSpace(*user.Email)},
			Subject: fmt.Sprintf("Rider assigned for order #%d", order.ID),
			Text:    fmt.Sprintf("A rider has been assigned to order #%d.", order.ID),
			HTML:    fmt.Sprintf(`<p>A rider has been assigned to order <strong>#%d</strong>.</p>`, order.ID),
		}); err != nil {
			return err
		}
	}
	return s.pushLine(ctx, user, message)
}

func (s *NotificationService) NotifyRiderOnTheWay(ctx context.Context, user model.User, order model.Order) error {
	if s == nil {
		return nil
	}
	message := fmt.Sprintf("คำสั่งซื้อ #%d อยู่ระหว่างจัดส่งแล้ว", order.ID)
	if user.Email != nil && strings.TrimSpace(*user.Email) != "" {
		if err := s.mailer.Send(ctx, EmailMessage{
			To:      []string{strings.TrimSpace(*user.Email)},
			Subject: fmt.Sprintf("Order #%d is on the way", order.ID),
			Text:    fmt.Sprintf("Order #%d is on the way.", order.ID),
			HTML:    fmt.Sprintf(`<p>Order <strong>#%d</strong> is on the way.</p>`, order.ID),
		}); err != nil {
			return err
		}
	}
	return s.pushLine(ctx, user, message)
}

func (s *NotificationService) pushLine(ctx context.Context, user model.User, message string) error {
	if s == nil || s.line == nil || user.AuthProvider != "line" || strings.TrimSpace(user.AuthSubject) == "" {
		return nil
	}
	return s.line.PushText(ctx, user.AuthSubject, message)
}
