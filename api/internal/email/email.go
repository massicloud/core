// Package email sends transactional email (currently only platform password
// reset) through a pluggable Sender.
package email

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// Message is a single transactional email.
type Message struct {
	To       string
	Subject  string
	HTMLBody string
	TextBody string
}

// Sender delivers a Message. Implementations must be safe for concurrent use.
type Sender interface {
	Send(ctx context.Context, msg Message) error
}

// ErrDisabled is returned by the disabled sender used when RESEND_API_KEY is
// not configured.
var ErrDisabled = errors.New("email: sending disabled (RESEND_API_KEY not set)")

// UnauthorizedError means the provider rejected the API key.
type UnauthorizedError struct{ Message string }

func (e *UnauthorizedError) Error() string {
	return fmt.Sprintf("email: unauthorized (bad or restricted API key): %s", e.Message)
}

// InvalidDomainError means the From domain is not verified with the provider.
type InvalidDomainError struct{ Message string }

func (e *InvalidDomainError) Error() string {
	return fmt.Sprintf("email: invalid or unverified sender domain: %s", e.Message)
}

// RateLimitedError means the provider returned 429.
type RateLimitedError struct {
	RetryAfter time.Duration // zero when the provider gave no Retry-After
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("email: rate limited by provider (retry after %s)", e.RetryAfter)
}

// APIError is any other non-2xx provider response.
type APIError struct {
	Status  int
	Name    string
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("email: provider error %d (%s): %s", e.Status, e.Name, e.Message)
}

type disabledSender struct{}

func (disabledSender) Send(context.Context, Message) error { return ErrDisabled }

// NewDisabledSender returns a Sender whose Send always fails with ErrDisabled.
func NewDisabledSender() Sender { return disabledSender{} }
