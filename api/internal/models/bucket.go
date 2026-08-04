package models

import "time"

type Bucket struct {
	ID        string    `json:"id"         db:"id"`
	ProjectID string    `json:"project_id" db:"project_id"`
	Name      string    `json:"name"       db:"name"`
	Public    bool      `json:"public"     db:"public"`
	SizeBytes int64     `json:"size_bytes" db:"size_bytes"`
	FileCount int64     `json:"file_count" db:"file_count"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateBucketRequest struct {
	Name      string `json:"name"`
	ProjectID string `json:"project_id"`
	Public    bool   `json:"public"`
}

type StorageObject struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	ContentType  string    `json:"content_type"`
	LastModified time.Time `json:"last_modified"`
	ETag         string    `json:"etag"`
	URL          string    `json:"url,omitempty"`
}

type ListObjectsResult struct {
	Objects           []StorageObject `json:"objects"`
	Folders           []string        `json:"folders"`
	Prefix            string          `json:"prefix"`
	ContinuationToken string          `json:"continuation_token,omitempty"`
	IsTruncated       bool            `json:"is_truncated"`
}

type PresignResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
	Method    string    `json:"method"`
}

type DownloadToken struct {
	Token     string    `db:"token"`
	Bucket    string    `db:"bucket"`
	Key       string    `db:"key"`
	ExpiresAt time.Time `db:"expires_at"`
}
