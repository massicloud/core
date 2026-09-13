package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/mikaminou/massicloud/api/internal/middleware"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// resolveMongoInstance authenticates the caller, loads the instance, and
// verifies the caller's platform user owns the project the instance
// belongs to. Every mongo_ops endpoint is admin/portal-only functionality
// (never reachable via an anon/service project API key), so this always
// checks platform-JWT ownership — there is no "public" tier for these
// routes the way there is for /v1/{slug}/...
func (h *Handler) resolveMongoInstance(w http.ResponseWriter, r *http.Request, ctx context.Context) (models.Instance, bool) {
	claims, ok := middleware.GetClaims(r)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "unauthorized")
		return models.Instance{}, false
	}

	id := chi.URLParam(r, "id")
	inst, err := h.store.GetInstance(ctx, id)
	if err != nil || inst.Type != models.InstanceTypeMongo {
		h.writeError(w, http.StatusNotFound, "instance not found")
		return models.Instance{}, false
	}

	project, err := h.store.GetProjectForInstance(ctx, inst.ID)
	if err != nil {
		h.writeError(w, http.StatusNotFound, "project not found")
		return models.Instance{}, false
	}
	if project.UserID != claims.UserID {
		h.writeError(w, http.StatusForbidden, "access denied")
		return models.Instance{}, false
	}

	return inst, true
}

func mongoDatabaseNameFromDSN(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(u.Path, "/")
}

// mongoDB opens (or reuses) a driver connection for the instance using its
// stored service-role credentials — never root.
func (h *Handler) mongoDB(ctx context.Context, inst models.Instance) (*mongo.Database, error) {
	client, err := h.mongo.GetClient(ctx, inst.ID, inst.DSN)
	if err != nil {
		return nil, err
	}
	return client.Database(mongoDatabaseNameFromDSN(inst.DSN)), nil
}

// ---- JSON-safety for BSON values -----------------------------------------

// toJSONSafe recursively converts BSON-specific types (ObjectID, DateTime,
// Decimal128) that encoding/json can't handle into JSON-friendly forms.
func toJSONSafe(v interface{}) interface{} {
	switch val := v.(type) {
	case primitive.ObjectID:
		return val.Hex()
	case primitive.DateTime:
		return val.Time().UTC().Format(time.RFC3339Nano)
	case primitive.Decimal128:
		return val.String()
	case bson.M:
		out := make(map[string]interface{}, len(val))
		for k, vv := range val {
			out[k] = toJSONSafe(vv)
		}
		return out
	case bson.D:
		out := make(map[string]interface{}, len(val))
		for _, e := range val {
			out[e.Key] = toJSONSafe(e.Value)
		}
		return out
	case bson.A:
		out := make([]interface{}, len(val))
		for i, vv := range val {
			out[i] = toJSONSafe(vv)
		}
		return out
	case map[string]interface{}:
		out := make(map[string]interface{}, len(val))
		for k, vv := range val {
			out[k] = toJSONSafe(vv)
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(val))
		for i, vv := range val {
			out[i] = toJSONSafe(vv)
		}
		return out
	default:
		return v
	}
}

// parseDocID accepts either a 24-char hex ObjectID or an arbitrary raw _id.
func parseDocID(raw string) interface{} {
	if oid, err := primitive.ObjectIDFromHex(raw); err == nil {
		return oid
	}
	return raw
}

// ---- Collections ------------------------------------------------------

type collectionInfo struct {
	Name       string `json:"name"`
	Count      int64  `json:"count"`
	Size       int64  `json:"size"`
	AvgObjSize int64  `json:"avgObjSize"`
	Indexes    int64  `json:"indexes"`
}

// GetMongoCollections handles GET /mongo/{id}/collections
func (h *Handler) GetMongoCollections(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}

	names, err := db.ListCollectionNames(ctx, bson.M{})
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list collections")
		return
	}

	result := make([]collectionInfo, 0, len(names))
	for _, name := range names {
		var stats bson.M
		_ = db.RunCommand(ctx, bson.D{{Key: "collStats", Value: name}}).Decode(&stats)

		count, _ := db.Collection(name).EstimatedDocumentCount(ctx)
		idxCount, _ := db.Collection(name).Indexes().ListSpecifications(ctx)

		info := collectionInfo{Name: name, Count: count, Indexes: int64(len(idxCount))}
		if stats != nil {
			if sz, ok := toInt64(stats["size"]); ok {
				info.Size = sz
			}
			if avg, ok := toInt64(stats["avgObjSize"]); ok {
				info.AvgObjSize = avg
			}
		}
		result = append(result, info)
	}

	h.writeJSON(w, http.StatusOK, result)
}

func toInt64(v interface{}) (int64, bool) {
	switch n := v.(type) {
	case int32:
		return int64(n), true
	case int64:
		return n, true
	case float64:
		return int64(n), true
	default:
		return 0, false
	}
}

// CreateMongoCollection handles POST /mongo/{id}/collections
func (h *Handler) CreateMongoCollection(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		h.writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	if err := db.CreateCollection(ctx, req.Name); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// DeleteMongoCollection handles DELETE /mongo/{id}/collections/{name}
func (h *Handler) DeleteMongoCollection(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	if err := db.Collection(name).Drop(ctx); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- Documents ----------------------------------------------------------

type documentsResponse struct {
	Documents []interface{} `json:"documents"`
	Total     int64         `json:"total"`
	Page      int           `json:"page"`
}

// GetMongoDocuments handles GET /mongo/{id}/collections/{name}/documents
func (h *Handler) GetMongoDocuments(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")

	limit := int64(20)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	skip := int64(0)
	if v := r.URL.Query().Get("skip"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 0 {
			skip = n
		}
	}

	filter := bson.M{}
	if raw := r.URL.Query().Get("filter"); raw != "" {
		if err := json.Unmarshal([]byte(raw), &filter); err != nil {
			h.writeError(w, http.StatusBadRequest, "filter must be valid JSON")
			return
		}
	}

	findOpts := options.Find().SetLimit(limit).SetSkip(skip)
	if sortParam := r.URL.Query().Get("sort"); sortParam != "" {
		field, dir, found := strings.Cut(sortParam, ":")
		order := 1
		if found && strings.EqualFold(dir, "desc") {
			order = -1
		}
		findOpts.SetSort(bson.D{{Key: field, Value: order}})
	}

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	coll := db.Collection(name)

	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to count documents")
		return
	}

	cursor, err := coll.Find(ctx, filter, findOpts)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to fetch documents")
		return
	}
	defer cursor.Close(ctx)

	docs := make([]interface{}, 0)
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		docs = append(docs, toJSONSafe(doc))
	}

	page := 1
	if limit > 0 {
		page = int(skip/limit) + 1
	}
	h.writeJSON(w, http.StatusOK, documentsResponse{Documents: docs, Total: total, Page: page})
}

// InsertMongoDocument handles POST /mongo/{id}/collections/{name}/documents
func (h *Handler) InsertMongoDocument(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")

	var doc bson.M
	if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON document")
		return
	}

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	res, err := db.Collection(name).InsertOne(ctx, doc)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]interface{}{
		"inserted_id": toJSONSafe(res.InsertedID),
	})
}

// UpdateMongoDocument handles PATCH /mongo/{id}/collections/{name}/documents/{docId}
func (h *Handler) UpdateMongoDocument(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")
	docID := parseDocID(chi.URLParam(r, "docId"))

	var body bson.M
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Accept either {"$set": {...}} or a bare field map — wrap the latter
	// in $set so callers never need to remember Mongo update-operator syntax
	// for a plain field edit (the portal always sends changed-fields-only).
	update := body
	hasOperator := false
	for k := range body {
		if strings.HasPrefix(k, "$") {
			hasOperator = true
			break
		}
	}
	if !hasOperator {
		delete(body, "_id")
		update = bson.M{"$set": body}
	}

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	res, err := db.Collection(name).UpdateOne(ctx, bson.M{"_id": docID}, update)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if res.MatchedCount == 0 {
		h.writeError(w, http.StatusNotFound, "document not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteMongoDocument handles DELETE /mongo/{id}/collections/{name}/documents/{docId}
func (h *Handler) DeleteMongoDocument(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")
	docID := parseDocID(chi.URLParam(r, "docId"))

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	res, err := db.Collection(name).DeleteOne(ctx, bson.M{"_id": docID})
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if res.DeletedCount == 0 {
		h.writeError(w, http.StatusNotFound, "document not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- Indexes --------------------------------------------------------------

type indexInfo struct {
	Name   string                 `json:"name"`
	Keys   map[string]interface{} `json:"keys"`
	Unique bool                   `json:"unique"`
	Sparse bool                   `json:"sparse"`
}

// GetMongoIndexes handles GET /mongo/{id}/collections/{name}/indexes
func (h *Handler) GetMongoIndexes(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}

	cursor, err := db.Collection(name).Indexes().List(ctx)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "failed to list indexes")
		return
	}
	defer cursor.Close(ctx)

	result := make([]indexInfo, 0)
	for cursor.Next(ctx) {
		var raw bson.M
		if err := cursor.Decode(&raw); err != nil {
			continue
		}
		info := indexInfo{Keys: map[string]interface{}{}}
		if n, ok := raw["name"].(string); ok {
			info.Name = n
		}
		if keys, ok := raw["key"].(bson.M); ok {
			for k, v := range keys {
				info.Keys[k] = toJSONSafe(v)
			}
		}
		if u, ok := raw["unique"].(bool); ok {
			info.Unique = u
		}
		if s, ok := raw["sparse"].(bool); ok {
			info.Sparse = s
		}
		result = append(result, info)
	}

	h.writeJSON(w, http.StatusOK, result)
}

// CreateMongoIndex handles POST /mongo/{id}/collections/{name}/indexes
func (h *Handler) CreateMongoIndex(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")

	var req struct {
		Name      string         `json:"name"`
		Keys      map[string]int `json:"keys"`
		Unique    bool           `json:"unique"`
		Sparse    bool           `json:"sparse"`
		TTLSecond *int32         `json:"ttl_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Keys) == 0 {
		h.writeError(w, http.StatusBadRequest, "at least one key is required")
		return
	}

	keys := bson.D{}
	for field, order := range req.Keys {
		keys = append(keys, bson.E{Key: field, Value: order})
	}

	idxOpts := options.Index().SetUnique(req.Unique).SetSparse(req.Sparse)
	if req.Name != "" {
		idxOpts.SetName(req.Name)
	}
	if req.TTLSecond != nil {
		idxOpts.SetExpireAfterSeconds(*req.TTLSecond)
	}

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	createdName, err := db.Collection(name).Indexes().CreateOne(ctx, mongo.IndexModel{Keys: keys, Options: idxOpts})
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]string{"name": createdName})
}

// DeleteMongoIndex handles DELETE /mongo/{id}/collections/{name}/indexes/{indexName}
func (h *Handler) DeleteMongoIndex(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}
	name := chi.URLParam(r, "name")
	indexName := chi.URLParam(r, "indexName")

	if indexName == "_id_" {
		h.writeError(w, http.StatusBadRequest, "the _id_ index cannot be dropped")
		return
	}

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}
	if _, err := db.Collection(name).Indexes().DropOne(ctx, indexName); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- Query console ---------------------------------------------------------

// mongoQueryAllowedCommands restricts the query console to read-only
// operations. Mutations must go through the dedicated document/collection/
// index routes above, which apply consistent auth + validation.
var mongoQueryAllowedCommands = map[string]bool{
	"find":      true,
	"findOne":   true,
	"count":     true,
	"aggregate": true,
	"distinct":  true,
}

// RunMongoQuery handles POST /mongo/{id}/query
func (h *Handler) RunMongoQuery(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	inst, ok := h.resolveMongoInstance(w, r, ctx)
	if !ok {
		return
	}

	var req struct {
		Command bson.M `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Command) == 0 {
		h.writeError(w, http.StatusBadRequest, "command is required")
		return
	}

	allowed := false
	for key := range req.Command {
		if mongoQueryAllowedCommands[key] {
			allowed = true
			break
		}
	}
	if !allowed {
		h.writeError(w, http.StatusForbidden,
			"only read-only commands (find, findOne, count, aggregate, distinct) are allowed here — use the collection/document/index routes for mutations")
		return
	}

	db, err := h.mongoDB(ctx, inst)
	if err != nil {
		h.writeError(w, http.StatusServiceUnavailable, "cannot connect to mongo instance")
		return
	}

	started := time.Now()
	var result bson.M
	err = db.RunCommand(ctx, req.Command).Decode(&result)
	tookMS := time.Since(started).Milliseconds()
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"result":  toJSONSafe(result),
		"took_ms": tookMS,
	})
}
