export type InstanceStatus = "running" | "stopped" | "error";
export type InstanceKind = "postgres" | "redis";

export interface Instance {
  id: string;
  project_id: string;
  name: string;
  type: string;
  status: InstanceStatus;
  host: string;
  port: number;
  dsn: string;
  memory_mb: number;
  backup_schedule: string;
  retention_days: number;
  created_at: string;
}

export interface CreateInstanceRequest {
  name: string;
  memory_mb: number;
  project_id: string;
  schemas?: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

// Auth types
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Project types
export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  postgres_count?: number;
  redis_count?: number;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export interface Bucket {
  id: string;
  project_id: string;
  name: string;
  public: boolean;
  size_bytes: number;
  file_count: number;
  created_at: string;
}

export interface StorageObject {
  key: string;
  size: number;
  content_type: string;
  last_modified: string;
  etag: string;
}

export interface ListObjectsResult {
  objects: StorageObject[];
  folders: string[];
  prefix: string;
  continuation_token?: string;
  is_truncated: boolean;
}

export interface PresignResponse {
  url: string;
  expires_at: string;
  method: string;
}

// ─── Backups ──────────────────────────────────────────────────────────────────

export type BackupType = "manual" | "scheduled";
export type BackupStatus = "pending" | "running" | "completed" | "failed";

export interface Backup {
  id: string;
  instance_id: string;
  project_id: string;
  type: BackupType;
  status: BackupStatus;
  size_bytes: number;
  minio_key: string;
  error: string;
  started_at: string;
  completed_at: string | null;
  expires_at: string;
}

export interface RestoreRequest {
  backup_id: string;
  new_name: string;
  memory_mb: number;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export type APIKeyType = "anon" | "service";

export interface APIKey {
  id: string;
  project_id: string;
  type: APIKeyType;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface APIKeyWithSecret extends APIKey {
  full_key: string;
}

export interface ProjectWithKeys {
  project: Project;
  anon_key: APIKeyWithSecret;
  service_key: APIKeyWithSecret;
}

// ─── Stages ───────────────────────────────────────────────────────────────────

export type InstanceType = 'postgres' | 'redis' | 'mongo'

export interface Stage {
  id:           string
  project_id:   string
  name:         string
  is_protected: boolean
  created_at:   string
  instances?:   Instance[]
}

export interface CreateInstanceForStageRequest {
  name:           string
  type:           InstanceType
  memory_mb:      number
  schema_preset?: string
  // Only used for instance types with configurable storage (currently
  // mongo — postgres/redis have fixed PVC sizes).
  storage_gb?:    number
}

export interface CreateStageRequest {
  name:              string
  is_protected:      boolean
  initial_instance?: CreateInstanceForStageRequest
}

export interface SchemaPreset {
  id:            string
  label:         string
  description:   string
  schemas:       string[]
  database_type: 'postgres' | 'mongo'
}

// ─── Mongo ────────────────────────────────────────────────────────────────────

export interface MongoInstance {
  id:              string
  stage_id:        string
  type:            'mongo'
  name:            string
  database_name:   string
  service_dsn:     string
  readonly_dsn:    string
  memory_mb:       number
  backup_schedule: string
  retention_days:  number
  created_at:      string
}

export interface MongoCollection {
  name:        string
  count:       number
  size:        number
  avgObjSize:  number
  indexes:     number
}

export interface MongoDocumentsResult {
  documents: Record<string, unknown>[]
  total:     number
  page:      number
}

export interface MongoIndex {
  name:   string
  keys:   Record<string, unknown>
  unique: boolean
  sparse: boolean
}

export interface CreateMongoIndexRequest {
  name?:         string
  keys:          Record<string, 1 | -1>
  unique?:       boolean
  sparse?:       boolean
  ttl_seconds?:  number
}

export interface MongoQueryResult {
  result:   unknown
  took_ms:  number
}
