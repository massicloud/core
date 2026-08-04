package storage

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/mikaminou/massicloud/api/internal/config"
	"github.com/mikaminou/massicloud/api/internal/models"
)

// Client wraps the MinIO SDK and exposes the operations the handlers need.
type Client struct {
	minio  *minio.Client
	logger *slog.Logger
	cfg    *config.Config
}

// New creates and verifies a MinIO connection.
func New(cfg *config.Config, logger *slog.Logger) (*Client, error) {
	mc, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioUser, cfg.MinioPassword, ""),
		Secure: cfg.MinioUseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("storage: create client: %w", err)
	}

	// Smoke-test the connection.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := mc.ListBuckets(ctx); err != nil {
		return nil, fmt.Errorf("storage: ping minio at %s: %w", cfg.MinioEndpoint, err)
	}

	logger.Info("storage client connected", slog.String("endpoint", cfg.MinioEndpoint))
	return &Client{minio: mc, logger: logger, cfg: cfg}, nil
}

// CreateBucket creates a new MinIO bucket and optionally makes it publicly readable.
func (c *Client) CreateBucket(ctx context.Context, name string, public bool) error {
	if err := c.minio.MakeBucket(ctx, name, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("storage: make bucket %q: %w", name, err)
	}

	if public {
		if err := c.setBucketPublicPolicy(ctx, name); err != nil {
			c.logger.Warn("storage: could not set public policy",
				slog.String("bucket", name),
				slog.Any("error", err),
			)
		}
	}

	c.logger.Info("storage: bucket created", slog.String("name", name))
	return nil
}

// RenameBucket copies all objects to a new bucket then removes the old one.
// This is the only way to rename in S3-compatible storage.
func (c *Client) RenameBucket(ctx context.Context, oldName, newName string) error {
	// 1. Create destination bucket.
	if err := c.minio.MakeBucket(ctx, newName, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("storage: create destination bucket %q: %w", newName, err)
	}

	// 2. Server-side copy every object.
	for obj := range c.minio.ListObjects(ctx, oldName, minio.ListObjectsOptions{Recursive: true}) {
		if obj.Err != nil {
			_ = c.minio.RemoveBucket(ctx, newName)
			return fmt.Errorf("storage: list objects in %q: %w", oldName, obj.Err)
		}
		_, err := c.minio.CopyObject(ctx,
			minio.CopyDestOptions{Bucket: newName, Object: obj.Key},
			minio.CopySrcOptions{Bucket: oldName, Object: obj.Key},
		)
		if err != nil {
			_ = c.minio.RemoveBucket(ctx, newName)
			return fmt.Errorf("storage: copy object %q: %w", obj.Key, err)
		}
	}

	// 3. Delete all objects from the old bucket.
	objCh := make(chan minio.ObjectInfo)
	go func() {
		defer close(objCh)
		for obj := range c.minio.ListObjects(ctx, oldName, minio.ListObjectsOptions{Recursive: true}) {
			if obj.Err != nil {
				return
			}
			objCh <- obj
		}
	}()
	for rerr := range c.minio.RemoveObjects(ctx, oldName, objCh, minio.RemoveObjectsOptions{}) {
		return fmt.Errorf("storage: delete old object: %w", rerr.Err)
	}

	// 4. Remove the now-empty old bucket.
	if err := c.minio.RemoveBucket(ctx, oldName); err != nil {
		return fmt.Errorf("storage: remove old bucket %q: %w", oldName, err)
	}

	c.logger.Info("storage: bucket renamed",
		slog.String("from", oldName),
		slog.String("to", newName),
	)
	return nil
}

// DeleteBucket removes an empty bucket.
func (c *Client) DeleteBucket(ctx context.Context, name string) error {
	if err := c.minio.RemoveBucket(ctx, name); err != nil {
		return fmt.Errorf("storage: remove bucket %q: %w", name, err)
	}
	c.logger.Info("storage: bucket deleted", slog.String("name", name))
	return nil
}

// SetBucketPublic toggles the bucket's public-read policy.
func (c *Client) SetBucketPublic(ctx context.Context, name string, public bool) error {
	if !public {
		if err := c.minio.SetBucketPolicy(ctx, name, ""); err != nil {
			return fmt.Errorf("storage: remove policy on %q: %w", name, err)
		}
		return nil
	}
	return c.setBucketPublicPolicy(ctx, name)
}

func (c *Client) setBucketPublicPolicy(ctx context.Context, name string) error {
	policy := fmt.Sprintf(`{
		"Version":"2012-10-17",
		"Statement":[{
			"Effect":"Allow",
			"Principal":"*",
			"Action":["s3:GetObject"],
			"Resource":["arn:aws:s3:::%s/*"]
		}]
	}`, name)
	if err := c.minio.SetBucketPolicy(ctx, name, policy); err != nil {
		return fmt.Errorf("storage: set public policy on %q: %w", name, err)
	}
	return nil
}

// UploadObject streams a file into the bucket.
func (c *Client) UploadObject(
	ctx context.Context,
	bucket, key string,
	reader io.Reader,
	size int64,
	contentType string,
) (models.StorageObject, error) {
	info, err := c.minio.PutObject(ctx, bucket, key, reader, size,
		minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return models.StorageObject{}, fmt.Errorf("storage: put object %q/%q: %w", bucket, key, err)
	}
	return models.StorageObject{
		Key:          info.Key,
		Size:         info.Size,
		ContentType:  contentType,
		ETag:         info.ETag,
		LastModified: time.Now(),
	}, nil
}

// ListObjects returns objects (and "folder" prefixes) under an optional prefix.
func (c *Client) ListObjects(
	ctx context.Context,
	bucket, prefix string,
	maxKeys int,
) (models.ListObjectsResult, error) {
	if maxKeys <= 0 || maxKeys > 1000 {
		maxKeys = 100
	}

	objects := make([]models.StorageObject, 0)
	folders := make([]string, 0)

	for obj := range c.minio.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: false,
		MaxKeys:   maxKeys,
	}) {
		if obj.Err != nil {
			return models.ListObjectsResult{}, fmt.Errorf("storage: list objects in %q: %w", bucket, obj.Err)
		}
		if strings.HasSuffix(obj.Key, "/") {
			folders = append(folders, obj.Key)
			continue
		}
		objects = append(objects, models.StorageObject{
			Key:          obj.Key,
			Size:         obj.Size,
			ContentType:  obj.ContentType,
			LastModified: obj.LastModified,
			ETag:         obj.ETag,
		})
	}

	return models.ListObjectsResult{
		Objects: objects,
		Folders: folders,
		Prefix:  prefix,
	}, nil
}

// StatObject returns the byte size of a single object without downloading it.
func (c *Client) StatObject(ctx context.Context, bucket, key string) (int64, error) {
	info, err := c.minio.StatObject(ctx, bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return 0, fmt.Errorf("storage: stat %q/%q: %w", bucket, key, err)
	}
	return info.Size, nil
}

// DeleteObject removes a single object.
func (c *Client) DeleteObject(ctx context.Context, bucket, key string) error {
	if err := c.minio.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("storage: remove object %q/%q: %w", bucket, key, err)
	}
	return nil
}

// GetObject returns a readable stream plus metadata for the object.
func (c *Client) GetObject(
	ctx context.Context,
	bucket, key string,
) (io.ReadCloser, *minio.ObjectInfo, error) {
	obj, err := c.minio.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("storage: get object %q/%q: %w", bucket, key, err)
	}
	info, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, nil, fmt.Errorf("storage: stat object %q/%q: %w", bucket, key, err)
	}
	return obj, &info, nil
}

// PresignGet generates a time-limited download URL.
func (c *Client) PresignGet(ctx context.Context, bucket, key string, expires time.Duration) (string, error) {
	u, err := c.minio.PresignedGetObject(ctx, bucket, key, expires, url.Values{})
	if err != nil {
		return "", fmt.Errorf("storage: presign get %q/%q: %w", bucket, key, err)
	}
	return u.String(), nil
}

// PresignPut generates a time-limited upload URL.
func (c *Client) PresignPut(ctx context.Context, bucket, key string, expires time.Duration) (string, error) {
	u, err := c.minio.PresignedPutObject(ctx, bucket, key, expires)
	if err != nil {
		return "", fmt.Errorf("storage: presign put %q/%q: %w", bucket, key, err)
	}
	return u.String(), nil
}

// EnsureBucket creates the bucket if it doesn't exist (idempotent).
func (c *Client) EnsureBucket(ctx context.Context, name string) error {
	exists, err := c.minio.BucketExists(ctx, name)
	if err != nil {
		return fmt.Errorf("storage: check bucket %q: %w", name, err)
	}
	if exists {
		return nil
	}
	if err := c.minio.MakeBucket(ctx, name, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("storage: make bucket %q: %w", name, err)
	}
	c.logger.Info("storage: bucket created", slog.String("name", name))
	return nil
}

// UploadObjectStream uploads from a reader of unknown size using multipart upload.
// Pass size=-1 when the total size is not known in advance.
func (c *Client) UploadObjectStream(
	ctx context.Context,
	bucket, key string,
	reader io.Reader,
	contentType string,
) (models.StorageObject, error) {
	info, err := c.minio.PutObject(ctx, bucket, key, reader, -1, minio.PutObjectOptions{
		ContentType: contentType,
		PartSize:    16 * 1024 * 1024, // 16 MB chunks
	})
	if err != nil {
		return models.StorageObject{}, fmt.Errorf("storage: upload stream %q/%q: %w", bucket, key, err)
	}
	return models.StorageObject{
		Key:          info.Key,
		Size:         info.Size,
		ContentType:  contentType,
		ETag:         info.ETag,
		LastModified: time.Now(),
	}, nil
}

// GetBucketStats returns the aggregate size and object count for a bucket.
func (c *Client) GetBucketStats(ctx context.Context, bucket string) (sizeBytes, count int64, err error) {
	for obj := range c.minio.ListObjects(ctx, bucket, minio.ListObjectsOptions{Recursive: true}) {
		if obj.Err != nil {
			return 0, 0, fmt.Errorf("storage: stats for %q: %w", bucket, obj.Err)
		}
		sizeBytes += obj.Size
		count++
	}
	return sizeBytes, count, nil
}
