package metrics

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

// HTTP records request count and latency. The route label is chi's matched
// pattern (e.g. /v1/{slug}/{stage}/db/{db}/rest/*), never the raw path, so
// cardinality stays bounded. Unmatched requests are labelled "unmatched".
func HTTP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chimiddleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)

		rctx := chi.RouteContext(r.Context())
		route := "unmatched"
		slug := ""
		if rctx != nil {
			if p := rctx.RoutePattern(); p != "" {
				route = p
			}
			slug = SlugLabel(rctx.URLParam("slug"))
		}
		status := ww.Status()
		if status == 0 {
			status = http.StatusOK
		}
		st := strconv.Itoa(status)
		HTTPRequestsTotal.WithLabelValues(r.Method, route, st, slug).Inc()
		HTTPRequestDuration.WithLabelValues(r.Method, route, st).Observe(time.Since(start).Seconds())
	})
}

// DBTracer times every pgx query on the control-plane pool.
type DBTracer struct{}

type dbSpan struct {
	start time.Time
	op    string
}

type dbSpanKey struct{}

func (DBTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	return context.WithValue(ctx, dbSpanKey{}, dbSpan{start: time.Now(), op: sqlVerb(data.SQL)})
}

func (DBTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	span, ok := ctx.Value(dbSpanKey{}).(dbSpan)
	if !ok {
		return
	}
	DBDuration.WithLabelValues(span.op).Observe(time.Since(span.start).Seconds())
	// ErrNoRows surfaces from row scanning, not the query, so any error here
	// is a real failure.
	if data.Err != nil {
		DBFailures.WithLabelValues(span.op).Inc()
	}
}

// RedisHook times every go-redis command and counts failures.
type RedisHook struct{}

func (RedisHook) DialHook(next redis.DialHook) redis.DialHook { return next }

func (RedisHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		start := time.Now()
		err := next(ctx, cmd)
		observeRedis(cmd.Name(), start, err)
		return err
	}
}

func (RedisHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		start := time.Now()
		err := next(ctx, cmds)
		observeRedis("pipeline", start, err)
		return err
	}
}

func observeRedis(cmd string, start time.Time, err error) {
	RedisDuration.WithLabelValues(cmd).Observe(time.Since(start).Seconds())
	if err != nil && !errors.Is(err, redis.Nil) {
		RedisFailures.WithLabelValues(cmd).Inc()
	}
}
