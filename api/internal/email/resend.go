package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	resendEndpoint = "https://api.resend.com/emails"
	// DefaultFrom is used when EMAIL_FROM is unset.
	DefaultFrom = "MassiCloud <noreply@massidigits.com>"
	sendTimeout = 10 * time.Second
)

// ResendSender delivers mail through the Resend HTTP API.
type ResendSender struct {
	apiKey   string
	from     string
	endpoint string
	client   *http.Client
	logger   *slog.Logger
}

// NewResendSender returns an error if apiKey is empty. An empty from falls
// back to DefaultFrom.
func NewResendSender(apiKey, from string, logger *slog.Logger) (*ResendSender, error) {
	if apiKey == "" {
		return nil, errors.New("email: resend API key is required")
	}
	if from == "" {
		from = DefaultFrom
	}
	if logger == nil {
		logger = slog.Default()
	}
	logger.Info("resend email sender initialized", slog.String("from", from))
	return &ResendSender{
		apiKey:   apiKey,
		from:     from,
		endpoint: resendEndpoint,
		client:   &http.Client{Timeout: sendTimeout},
		logger:   logger,
	}, nil
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

type resendErrorBody struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}

func (s *ResendSender) Send(ctx context.Context, msg Message) error {
	body, err := json.Marshal(resendRequest{
		From:    s.from,
		To:      []string{msg.To},
		Subject: msg.Subject,
		HTML:    msg.HTMLBody,
		Text:    msg.TextBody,
	})
	if err != nil {
		return fmt.Errorf("email: marshal request: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, sendTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("email: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("email: send request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	var eb resendErrorBody
	_ = json.Unmarshal(raw, &eb)
	if eb.Message == "" {
		eb.Message = strings.TrimSpace(string(raw))
	}

	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return &UnauthorizedError{Message: eb.Message}
	case resp.StatusCode == http.StatusForbidden,
		resp.StatusCode == http.StatusUnprocessableEntity && strings.Contains(strings.ToLower(eb.Message), "domain"):
		return &InvalidDomainError{Message: eb.Message}
	case resp.StatusCode == http.StatusTooManyRequests:
		var retry time.Duration
		if secs, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil && secs > 0 {
			retry = time.Duration(secs) * time.Second
		}
		return &RateLimitedError{RetryAfter: retry}
	default:
		return &APIError{Status: resp.StatusCode, Name: eb.Name, Message: eb.Message}
	}
}
