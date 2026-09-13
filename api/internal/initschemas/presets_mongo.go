package initschemas

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoPreset is Mongo's analog to SchemaPreset — Mongo has no schemas to
// apply SQL against, so a preset instead runs driver code (creating
// collections/indexes) against the freshly-provisioned database.
type MongoPreset struct {
	ID          string
	Label       string
	Description string
	Setup       func(ctx context.Context, dsn, dbName string) error
}

var MongoPresets = map[string]MongoPreset{
	"blank": {
		ID:          "blank",
		Label:       "Blank",
		Description: "Empty database.",
		Setup:       func(ctx context.Context, dsn, dbName string) error { return nil },
	},
	"users_basic": {
		ID:          "users_basic",
		Label:       "Users (basic)",
		Description: "Users collection with a unique index on email.",
		Setup: func(ctx context.Context, dsn, dbName string) error {
			return withMongoClient(ctx, dsn, dbName, func(db *mongo.Database) error {
				_, err := db.Collection("users").Indexes().CreateOne(ctx, mongo.IndexModel{
					Keys:    bson.D{{Key: "email", Value: 1}},
					Options: options.Index().SetUnique(true),
				})
				return err
			})
		},
	},
	"blog_starter": {
		ID:          "blog_starter",
		Label:       "Blog starter",
		Description: "posts + comments collections with common indexes.",
		Setup: func(ctx context.Context, dsn, dbName string) error {
			return withMongoClient(ctx, dsn, dbName, func(db *mongo.Database) error {
				postIdx := []mongo.IndexModel{
					{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)},
					{Keys: bson.D{{Key: "author", Value: 1}}},
					{Keys: bson.D{{Key: "publishedAt", Value: -1}}},
				}
				if _, err := db.Collection("posts").Indexes().CreateMany(ctx, postIdx); err != nil {
					return fmt.Errorf("posts indexes: %w", err)
				}
				commentIdx := mongo.IndexModel{Keys: bson.D{{Key: "postId", Value: 1}}}
				if _, err := db.Collection("comments").Indexes().CreateOne(ctx, commentIdx); err != nil {
					return fmt.Errorf("comments index: %w", err)
				}
				return nil
			})
		},
	},
}

func withMongoClient(ctx context.Context, dsn, dbName string, fn func(db *mongo.Database) error) error {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(dsn))
	if err != nil {
		return fmt.Errorf("mongo preset: connect: %w", err)
	}
	defer client.Disconnect(context.Background())

	return fn(client.Database(dbName))
}

// ApplyMongoPreset looks up and runs a Mongo schema preset by ID. Used by
// the stage provisioning flow — mirrors initschemas.Service.Apply for
// Postgres, but driver-based rather than SQL-file-based.
func ApplyMongoPreset(ctx context.Context, dsn, dbName, presetID string) error {
	preset, ok := MongoPresets[presetID]
	if !ok {
		return fmt.Errorf("initschemas: unknown mongo preset %q", presetID)
	}
	return preset.Setup(ctx, dsn, dbName)
}

// ListMongoPresets returns every Mongo preset in the shared SchemaPreset
// shape so the portal's existing database_type filter picks them up
// alongside the Postgres ones.
func ListMongoPresets() []SchemaPreset {
	order := []string{"blank", "users_basic", "blog_starter"}
	result := make([]SchemaPreset, 0, len(order))
	for _, id := range order {
		p := MongoPresets[id]
		result = append(result, SchemaPreset{
			ID:           p.ID,
			Label:        p.Label,
			Description:  p.Description,
			Schemas:      []string{},
			DatabaseType: "mongo",
		})
	}
	return result
}
