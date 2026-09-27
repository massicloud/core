package middleware

import "net/http"

// MaxBytes caps the request body at n bytes. A handler that reads past the
// limit gets an error from the body reader (surfaced as a JSON decode
// failure by handlers that decode the body as JSON), instead of the server
// buffering an arbitrarily large body in memory.
func MaxBytes(n int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, n)
			next.ServeHTTP(w, r)
		})
	}
}
