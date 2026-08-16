package models

// Instance types
const (
	InstanceTypePostgres = "postgres"
	InstanceTypeRedis    = "redis"
	InstanceTypeMinio    = "minio"
)

// Docker images
const (
	PostgresImage = "postgres:16-alpine"
	RedisImage    = "redis:7-alpine"
	MinioImage    = "minio/minio:latest"
)

// Docker networking
const (
	PostgresContainerPort = "5432/tcp"
	RedisContainerPort    = "6379/tcp"
	NetworkName           = "massicloud"
	HostIP                = "0.0.0.0"
)

// Docker labels
const (
	LabelType    = "massicloud.type"
	LabelTenant  = "massicloud.tenant"
	LabelManaged = "massicloud.managed"
	LabelPort    = "massicloud.port"
	LabelHost    = "massicloud.host"
	LabelTrue    = "true"
)

// ContainerState mirrors Docker container states as a typed enum
type ContainerState string

const (
	ContainerStateRunning ContainerState = "running"
	ContainerStateExited  ContainerState = "exited"
	ContainerStateDead    ContainerState = "dead"
	ContainerStatePaused  ContainerState = "paused"
	ContainerStateCreated ContainerState = "created"
)
