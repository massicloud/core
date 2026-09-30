package email

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRenderPasswordReset(t *testing.T) {
	data := PasswordResetData{FullName: "Amine", ResetURL: "https://app.massicloud.work/reset?token=abc123"}
	h, txt, err := RenderPasswordReset(data)
	if err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{"html": h, "text": txt} {
		for _, want := range []string{"Hello Amine,", data.ResetURL, "expires in 1 hour", "MassiDigits"} {
			if !strings.Contains(body, want) {
				t.Errorf("%s body missing %q", name, want)
			}
		}
		if strings.Contains(body, "{{") {
			t.Errorf("%s body has unrendered template markers", name)
		}
	}
	for _, want := range []string{"#1e40af", "max-width:600px", "Reset password"} {
		if !strings.Contains(h, want) {
			t.Errorf("html missing %q", want)
		}
	}
}

func TestRenderPasswordResetEscapesHTML(t *testing.T) {
	h, txt, err := RenderPasswordReset(PasswordResetData{FullName: "<script>x</script>", ResetURL: "https://x/reset?token=1"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(h, "<script>") {
		t.Error("html template did not escape FullName")
	}
	if !strings.Contains(txt, "<script>x</script>") {
		t.Error("text template should not HTML-escape")
	}
}

func TestNewResendSenderRequiresKey(t *testing.T) {
	if _, err := NewResendSender("", "", slog.New(slog.NewTextHandler(io.Discard, nil))); err == nil {
		t.Fatal("expected error for empty API key")
	}
}

func testSender(t *testing.T, h http.HandlerFunc) *ResendSender {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	s, err := NewResendSender("re_test", "", slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	s.endpoint = srv.URL
	return s
}

func TestResendSendRequestShape(t *testing.T) {
	s := testSender(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer re_test" {
			t.Errorf("bad auth header %q", r.Header.Get("Authorization"))
		}
		var got map[string]any
		json.NewDecoder(r.Body).Decode(&got)
		if got["from"] != DefaultFrom || got["subject"] != "S" || got["html"] != "<b>h</b>" || got["text"] != "t" {
			t.Errorf("unexpected body: %v", got)
		}
		if to, _ := got["to"].([]any); len(to) != 1 || to[0] != "a@b.dz" {
			t.Errorf("unexpected to: %v", got["to"])
		}
		w.WriteHeader(200)
	})
	if err := s.Send(context.Background(), Message{To: "a@b.dz", Subject: "S", HTMLBody: "<b>h</b>", TextBody: "t"}); err != nil {
		t.Fatal(err)
	}
}

func TestResendSendErrorTypes(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
		check  func(error) bool
	}{
		{"unauthorized", 401, `{"name":"invalid_api_key","message":"bad key"}`, func(e error) bool { var t *UnauthorizedError; return errors.As(e, &t) }},
		{"domain 403", 403, `{"message":"domain is not verified"}`, func(e error) bool { var t *InvalidDomainError; return errors.As(e, &t) }},
		{"domain 422", 422, `{"message":"The massidigits.com domain is not verified"}`, func(e error) bool { var t *InvalidDomainError; return errors.As(e, &t) }},
		{"rate limited", 429, `{"message":"slow down"}`, func(e error) bool { var t *RateLimitedError; return errors.As(e, &t) }},
		{"generic", 500, `{"name":"application_error","message":"boom"}`, func(e error) bool { var t *APIError; return errors.As(e, &t) && t.Status == 500 }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := testSender(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(c.status)
				io.WriteString(w, c.body)
			})
			err := s.Send(context.Background(), Message{To: "a@b.dz"})
			if err == nil || !c.check(err) {
				t.Fatalf("got %v", err)
			}
		})
	}
}

func TestDisabledSender(t *testing.T) {
	if err := NewDisabledSender().Send(context.Background(), Message{}); !errors.Is(err, ErrDisabled) {
		t.Fatalf("got %v", err)
	}
}
