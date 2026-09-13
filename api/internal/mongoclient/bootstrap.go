package mongoclient

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// mongoAlreadyExistsCode is the server error code MongoDB returns for
// "user already exists" (Location51003) — treated as success so bootstrap
// is safe to retry.
const mongoAlreadyExistsCode = 51003

// BootstrapReplicaSetAndUsers prepares a freshly-created single-node Mongo
// instance for application use: initiates its (single-member) replica set
// if not already done, then creates the massi_service (readWrite) and
// massi_readonly (read) application users. Connects via the driver using
// root credentials rather than exec'ing into the pod or running a k8s Job —
// the driver is already a dependency for the collection/document endpoints,
// so this reuses it instead of adding a second init mechanism.
//
// Safe to call multiple times: every step checks current state before
// acting.
func BootstrapReplicaSetAndUsers(
	ctx context.Context,
	rootDSN, host, dbName, servicePassword, readonlyPassword string,
) error {
	client, err := Connect(ctx, rootDSN)
	if err != nil {
		return fmt.Errorf("bootstrap: connect as root: %w", err)
	}
	defer client.Disconnect(context.Background())

	if err := ensureReplicaSetInitiated(ctx, client, host); err != nil {
		return fmt.Errorf("bootstrap: replica set: %w", err)
	}

	// rs.initiate() needs a moment to elect the single member PRIMARY before
	// createUser (a write) will succeed.
	if err := waitForPrimary(ctx, client); err != nil {
		return fmt.Errorf("bootstrap: wait for primary: %w", err)
	}

	admin := client.Database("admin")
	if err := createUserIfAbsent(ctx, admin, "massi_service", servicePassword, "readWrite", dbName); err != nil {
		return fmt.Errorf("bootstrap: create massi_service: %w", err)
	}
	if err := createUserIfAbsent(ctx, admin, "massi_readonly", readonlyPassword, "read", dbName); err != nil {
		return fmt.Errorf("bootstrap: create massi_readonly: %w", err)
	}
	return nil
}

func ensureReplicaSetInitiated(ctx context.Context, client *mongo.Client, host string) error {
	var status bson.M
	err := client.Database("admin").RunCommand(ctx, bson.D{{Key: "replSetGetStatus", Value: 1}}).Decode(&status)
	if err == nil {
		return nil // already initiated
	}
	// "NotYetInitialized" (code 94) is the expected error on a fresh node —
	// anything else is a real failure.
	if !strings.Contains(err.Error(), "NotYetInitialized") && !strings.Contains(err.Error(), "no replset config") {
		return fmt.Errorf("check replset status: %w", err)
	}

	cfg := bson.D{
		{Key: "_id", Value: "rs0"},
		{Key: "members", Value: bson.A{
			bson.D{{Key: "_id", Value: 0}, {Key: "host", Value: host}},
		}},
	}
	if err := client.Database("admin").RunCommand(ctx, bson.D{{Key: "replSetInitiate", Value: cfg}}).Err(); err != nil {
		return fmt.Errorf("replSetInitiate: %w", err)
	}
	return nil
}

func waitForPrimary(ctx context.Context, client *mongo.Client) error {
	deadline := time.Now().Add(30 * time.Second)
	for {
		var status bson.M
		err := client.Database("admin").RunCommand(ctx, bson.D{{Key: "isMaster", Value: 1}}).Decode(&status)
		if err == nil {
			if isMaster, ok := status["ismaster"].(bool); ok && isMaster {
				return nil
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("no primary after 30s")
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func createUserIfAbsent(ctx context.Context, admin *mongo.Database, username, password, role, dbName string) error {
	cmd := bson.D{
		{Key: "createUser", Value: username},
		{Key: "pwd", Value: password},
		{Key: "roles", Value: bson.A{
			bson.D{{Key: "role", Value: role}, {Key: "db", Value: dbName}},
		}},
	}
	err := admin.RunCommand(ctx, cmd).Err()
	if err == nil {
		return nil
	}
	if isAlreadyExistsErr(err) {
		return nil
	}
	return err
}

func isAlreadyExistsErr(err error) bool {
	var cmdErr mongo.CommandError
	if ok := asCommandError(err, &cmdErr); ok {
		return cmdErr.Code == mongoAlreadyExistsCode
	}
	return strings.Contains(err.Error(), "already exists")
}

func asCommandError(err error, target *mongo.CommandError) bool {
	if ce, ok := err.(mongo.CommandError); ok {
		*target = ce
		return true
	}
	return false
}
