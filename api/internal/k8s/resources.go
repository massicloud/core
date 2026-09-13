package k8s

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

// ResourceProfile is the standard way to attach resources to every
// container. Callers pick the profile that matches the container's role —
// never call resource.MustParse inline in a container spec; go through a
// profile here instead. The tenant ResourceQuota (see
// ApplyTenantResourceQuota) requires every container to declare all four
// fields, so a profile that's missing one will fail provisioning with a
// quota-violation error instead of silently under-requesting.
type ResourceProfile struct {
	CPURequest    string
	MemoryRequest string
	CPULimit      string
	MemoryLimit   string
}

func (p ResourceProfile) ToRequirements() corev1.ResourceRequirements {
	return corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse(p.CPURequest),
			corev1.ResourceMemory: resource.MustParse(p.MemoryRequest),
		},
		Limits: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse(p.CPULimit),
			corev1.ResourceMemory: resource.MustParse(p.MemoryLimit),
		},
	}
}

// Predefined profiles for common container roles.
var (
	// Small init containers doing chmod/chown/sleep.
	ProfileInitTiny = ResourceProfile{
		CPURequest: "10m", MemoryRequest: "16Mi",
		CPULimit: "50m", MemoryLimit: "32Mi",
	}

	// REST proxies (PostgREST, mysql-rest, etc.).
	ProfileProxy = ResourceProfile{
		CPURequest: "50m", MemoryRequest: "64Mi",
		CPULimit: "200m", MemoryLimit: "256Mi",
	}

	// Redis default — only used as a fallback; redis.go scales via
	// DatabaseProfile(req.MemoryMB) since Redis memory is user-configurable.
	ProfileRedisDefault = ResourceProfile{
		CPURequest: "50m", MemoryRequest: "32Mi",
		CPULimit: "200m", MemoryLimit: "128Mi",
	}
)

// DatabaseProfile builds resources for a user-provisioned database
// (Postgres, MySQL, Mongo, Redis) based on user-requested memory. CPU
// scales conservatively with memory.
func DatabaseProfile(memoryMB int) ResourceProfile {
	if memoryMB < 128 {
		memoryMB = 128
	}
	cpuReq := "100m"
	cpuLim := "500m"
	if memoryMB >= 1024 {
		cpuReq = "200m"
		cpuLim = "1000m"
	}
	if memoryMB >= 2048 {
		cpuReq = "500m"
		cpuLim = "2000m"
	}
	return ResourceProfile{
		CPURequest:    cpuReq,
		MemoryRequest: fmt.Sprintf("%dMi", memoryMB),
		CPULimit:      cpuLim,
		MemoryLimit:   fmt.Sprintf("%dMi", memoryMB),
	}
}
