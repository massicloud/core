package handlers

import (
	"context"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/mikaminou/massicloud/api/internal/config"
	"github.com/mikaminou/massicloud/api/internal/email"
	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
	"github.com/mikaminou/massicloud/api/internal/ratelimit"
	"github.com/mikaminou/massicloud/api/internal/store"
)

type fakeToken struct {
	id, userID string
	expiresAt  time.Time
	used       bool
}

type fakeStore struct {
	mu        sync.Mutex
	users     map[string]models.User // by email
	tokens    map[string]*fakeToken  // by hash
	inserts   int
	passwords map[string]string // userID -> bcrypt hash
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		users:     map[string]models.User{"amine@example.dz": {ID: "u1", Email: "amine@example.dz", FullName: "Amine"}},
		tokens:    map[string]*fakeToken{},
		passwords: map[string]string{},
	}
}

func (f *fakeStore) GetUserByEmail(_ context.Context, e string) (models.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if u, ok := f.users[e]; ok {
		return u, nil
	}
	return models.User{}, errors.New("no rows")
}

func (f *fakeStore) CreatePlatformResetToken(_ context.Context, userID, hash string, exp time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.inserts++
	f.tokens[hash] = &fakeToken{id: "t-" + hash[:6], userID: userID, expiresAt: exp}
	return nil
}

func (f *fakeStore) FindValidPlatformResetToken(_ context.Context, hash string) (string, string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	t, ok := f.tokens[hash]
	if !ok || t.used || !t.expiresAt.After(time.Now()) {
		return "", "", store.ErrInvalidResetToken
	}
	return t.id, t.userID, nil
}

func (f *fakeStore) ApplyPlatformPasswordReset(_ context.Context, tokenID, userID, pw string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, t := range f.tokens {
		if t.id == tokenID {
			t.used = true
		}
	}
	f.passwords[userID] = pw
	return nil
}

type fakeSender struct{ ch chan email.Message }

func (s *fakeSender) Send(_ context.Context, m email.Message) error {
	s.ch <- m
	return nil
}

func newResetHandler(fs *fakeStore) (*Handler, *fakeSender) {
	sender := &fakeSender{ch: make(chan email.Message, 4)}
	return &Handler{
		logger:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		config:      &config.Config{PortalURL: "https://app.massicloud.work"},
		resetStore:  fs,
		emailSender: sender,
	}, sender
}

func post(h http.HandlerFunc, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
	return rec
}

func TestGenerateResetToken(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		tok, err := generateResetToken()
		if err != nil {
			t.Fatal(err)
		}
		if len(tok) != 64 {
			t.Fatalf("len = %d, want 64", len(tok))
		}
		if _, err := hex.DecodeString(tok); err != nil {
			t.Fatalf("not hex: %v", err)
		}
		if seen[tok] {
			t.Fatal("duplicate token")
		}
		seen[tok] = true
	}
}

func TestHashResetToken(t *testing.T) {
	// SHA-256("abc")
	const want = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
	if got := hashResetToken("abc"); got != want {
		t.Fatalf("got %s", got)
	}
}

func TestRequestReset_ExistingEmail(t *testing.T) {
	fs := newFakeStore()
	h, sender := newResetHandler(fs)
	rec := post(h.RequestPlatformPasswordReset, `{"email":"amine@example.dz"}`)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), "if an account exists") {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	select {
	case m := <-sender.ch:
		if m.To != "amine@example.dz" || m.Subject != "Reset your MassiCloud password" {
			t.Errorf("bad message %+v", m)
		}
		if !strings.Contains(m.HTMLBody, "https://app.massicloud.work/reset?token=") || !strings.Contains(m.TextBody, "Hello Amine,") {
			t.Errorf("bodies missing url/name")
		}
		// The raw token in the email must hash to the stored row, and only the hash is stored.
		tok := m.TextBody[strings.Index(m.TextBody, "token=")+6:]
		tok = tok[:64]
		if _, ok := fs.tokens[hashResetToken(tok)]; !ok {
			t.Error("stored token_hash does not match emailed token")
		}
		if _, ok := fs.tokens[tok]; ok {
			t.Error("raw token stored")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("sender not called")
	}
	if fs.inserts != 1 {
		t.Errorf("inserts = %d", fs.inserts)
	}
}

func TestRequestReset_UnknownEmail(t *testing.T) {
	fs := newFakeStore()
	h, sender := newResetHandler(fs)
	rec := post(h.RequestPlatformPasswordReset, `{"email":"nobody@example.dz"}`)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), "if an account exists") {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	time.Sleep(50 * time.Millisecond)
	if len(sender.ch) != 0 || fs.inserts != 0 {
		t.Errorf("sender/insert should not run: sent=%d inserts=%d", len(sender.ch), fs.inserts)
	}
}

func TestRequestReset_SendFailureStill200(t *testing.T) {
	fs := newFakeStore()
	h, _ := newResetHandler(fs)
	h.emailSender = email.NewDisabledSender()
	if rec := post(h.RequestPlatformPasswordReset, `{"email":"amine@example.dz"}`); rec.Code != 200 {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestRequestReset_InvalidEmail(t *testing.T) {
	h, _ := newResetHandler(newFakeStore())
	if rec := post(h.RequestPlatformPasswordReset, `{"email":"not-an-email"}`); rec.Code != 400 {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestRequestReset_RateLimited(t *testing.T) {
	fs := newFakeStore()
	h, _ := newResetHandler(fs)
	limiter := ratelimit.NewHybrid(nil, h.logger)
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireCategoryByIP(limiter, ratelimit.CategoryAuth))
		r.Post("/auth/reset-password", h.RequestPlatformPasswordReset)
	})
	do := func(ip string) int {
		req := httptest.NewRequest(http.MethodPost, "/auth/reset-password", strings.NewReader(`{"email":"nobody@example.dz"}`))
		req.RemoteAddr = ip + ":1234"
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec.Code
	}
	got429 := false
	for i := 0; i < 30; i++ {
		if do("10.0.0.1") == 429 {
			got429 = true
			break
		}
	}
	if !got429 {
		t.Fatal("expected 429 after exceeding the auth limit")
	}
	if do("10.0.0.2") != 200 {
		t.Error("a different IP must have its own bucket")
	}
}

func seedToken(fs *fakeStore, raw string, exp time.Time, used bool) {
	fs.tokens[hashResetToken(raw)] = &fakeToken{id: "tok1", userID: "u1", expiresAt: exp, used: used}
}

func TestConfirmReset_Valid(t *testing.T) {
	fs := newFakeStore()
	h, _ := newResetHandler(fs)
	seedToken(fs, "goodtoken", time.Now().Add(time.Hour), false)
	rec := post(h.ConfirmPlatformPasswordReset, `{"token":"goodtoken","new_password":"newpassword1"}`)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), "password reset successful") {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	if !fs.tokens[hashResetToken("goodtoken")].used {
		t.Error("token not marked used")
	}
	if bcrypt.CompareHashAndPassword([]byte(fs.passwords["u1"]), []byte("newpassword1")) != nil {
		t.Error("password not updated with bcrypt hash")
	}
	// Replay must now fail.
	if rec := post(h.ConfirmPlatformPasswordReset, `{"token":"goodtoken","new_password":"another123"}`); rec.Code != 400 {
		t.Errorf("replay got %d", rec.Code)
	}
}

func TestConfirmReset_Invalid(t *testing.T) {
	fs := newFakeStore()
	h, _ := newResetHandler(fs)
	seedToken(fs, "expired", time.Now().Add(-time.Minute), false)
	seedToken(fs, "usedtok", time.Now().Add(time.Hour), true)
	for _, tok := range []string{"expired", "usedtok", "unknown"} {
		rec := post(h.ConfirmPlatformPasswordReset, `{"token":"`+tok+`","new_password":"newpassword1"}`)
		if rec.Code != 400 || !strings.Contains(rec.Body.String(), "invalid or expired reset token") {
			t.Errorf("%s: got %d %s", tok, rec.Code, rec.Body)
		}
	}
	if len(fs.passwords) != 0 {
		t.Error("password must not change for invalid tokens")
	}
}

func TestConfirmReset_ShortPassword(t *testing.T) {
	fs := newFakeStore()
	h, _ := newResetHandler(fs)
	seedToken(fs, "goodtoken", time.Now().Add(time.Hour), false)
	if rec := post(h.ConfirmPlatformPasswordReset, `{"token":"goodtoken","new_password":"short"}`); rec.Code != 400 {
		t.Fatalf("got %d", rec.Code)
	}
	if fs.tokens[hashResetToken("goodtoken")].used {
		t.Error("token must not be consumed by a rejected password")
	}
}
