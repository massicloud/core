package k8s

import (
	"context"
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type CreateMySQLRequest struct {
	ProjectID       string
	InstanceName    string // e.g. "main"
	RootPassword    string
	AnonPassword    string // for massi_anon user
	ServicePassword string // for massi_service user
	DatabaseName    string // "appdb"
	MemoryMB        int
}

type MySQLRef struct {
	Namespace       string
	Service         string
	Port            int
	RootPassword    string
	AnonPassword    string
	ServicePassword string
	DatabaseName    string
	RootDSN         string // for schema init / SQL console only
	AnonDSN         string
	ServiceDSN      string
}

// CreateTenantMySQL follows the same create-if-absent pattern as
// CreateTenantPostgres. The init ConfigMap creates the massi_anon read-only
// user and pins every login's auth plugin to mysql_native_password — MySQL
// 8.4 defaults to caching_sha2_password, which go-sql-driver/mysql cannot
// use over a non-TLS connection.
func (c *Client) CreateTenantMySQL(ctx context.Context, req CreateMySQLRequest) (*MySQLRef, error) {
	ns := TenantNamespaceName(req.ProjectID)
	name := "mysql-" + req.InstanceName

	// 1. Secret with the root/anon/service passwords + database name.
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-creds",
			Namespace: ns,
		},
		StringData: map[string]string{
			"MYSQL_ROOT_PASSWORD": req.RootPassword,
			"MYSQL_ANON_PASSWORD": req.AnonPassword,
			"MYSQL_PASSWORD":      req.ServicePassword, // massi_service — matches MYSQL_USER below
			"MYSQL_DATABASE":      req.DatabaseName,
		},
	}
	_, err := c.cs.CoreV1().Secrets(ns).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create mysql secret: %w", err)
	}

	// 2. Init ConfigMap — runs once on first boot via
	// /docker-entrypoint-initdb.d/*.sql (built dynamically, passwords vary
	// per tenant so this can't be a static asset).
	initSQL := fmt.Sprintf(`
ALTER USER 'root'@'%%' IDENTIFIED WITH mysql_native_password BY '%s';
ALTER USER 'massi_service'@'%%' IDENTIFIED WITH mysql_native_password BY '%s';
CREATE USER 'massi_anon'@'%%' IDENTIFIED WITH mysql_native_password BY '%s';
GRANT SELECT ON `+"`%s`"+`.* TO 'massi_anon'@'%%';
FLUSH PRIVILEGES;
`, req.RootPassword, req.ServicePassword, req.AnonPassword, req.DatabaseName)

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name + "-init",
			Namespace: ns,
		},
		Data: map[string]string{
			"init.sql": initSQL,
		},
	}
	_, err = c.cs.CoreV1().ConfigMaps(ns).Create(ctx, configMap, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create mysql init configmap: %w", err)
	}

	// 3. StatefulSet.
	memoryMB := req.MemoryMB
	if memoryMB <= 0 {
		memoryMB = 512
	}
	memory := resource.MustParse(fmt.Sprintf("%dMi", memoryMB))
	cpu := resource.MustParse("500m")
	volSize := resource.MustParse("5Gi")

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "mysql"},
		},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: name,
			Replicas:    ptrInt32(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": name, "component": "mysql"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "mysql",
						Image: c.cfg.MySQLImage,
						Ports: []corev1.ContainerPort{{
							Name:          "mysql",
							ContainerPort: 3306,
						}},
						Env: []corev1.EnvVar{
							{Name: "MYSQL_ROOT_HOST", Value: "%"}, // allow root@'%' — needed for in-cluster access
							{Name: "MYSQL_USER", Value: "massi_service"},
							{Name: "MYSQL_DATABASE", ValueFrom: &corev1.EnvVarSource{
								SecretKeyRef: &corev1.SecretKeySelector{
									LocalObjectReference: corev1.LocalObjectReference{Name: name + "-creds"},
									Key:                  "MYSQL_DATABASE",
								},
							}},
							{Name: "MYSQL_PASSWORD", ValueFrom: &corev1.EnvVarSource{
								SecretKeyRef: &corev1.SecretKeySelector{
									LocalObjectReference: corev1.LocalObjectReference{Name: name + "-creds"},
									Key:                  "MYSQL_PASSWORD",
								},
							}},
							{Name: "MYSQL_ROOT_PASSWORD", ValueFrom: &corev1.EnvVarSource{
								SecretKeyRef: &corev1.SecretKeySelector{
									LocalObjectReference: corev1.LocalObjectReference{Name: name + "-creds"},
									Key:                  "MYSQL_ROOT_PASSWORD",
								},
							}},
						},
						VolumeMounts: []corev1.VolumeMount{
							{
								Name:      "data",
								MountPath: "/var/lib/mysql",
							},
							{
								Name:      "init",
								MountPath: "/docker-entrypoint-initdb.d",
								ReadOnly:  true,
							},
						},
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								corev1.ResourceMemory: memory,
								corev1.ResourceCPU:    cpu,
							},
							Limits: corev1.ResourceList{
								corev1.ResourceMemory: memory,
							},
						},
						ReadinessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								Exec: &corev1.ExecAction{
									// exec probes don't invoke a shell — wrap in sh -c
									// so $MYSQL_ROOT_PASSWORD actually expands.
									Command: []string{"sh", "-c", "mysqladmin ping -uroot -p$MYSQL_ROOT_PASSWORD"},
								},
							},
							InitialDelaySeconds: 10,
							PeriodSeconds:       5,
						},
					}},
					Volumes: []corev1.Volume{{
						Name: "init",
						VolumeSource: corev1.VolumeSource{
							ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: name + "-init"},
							},
						},
					}},
				},
			},
			VolumeClaimTemplates: []corev1.PersistentVolumeClaim{{
				ObjectMeta: metav1.ObjectMeta{Name: "data"},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{corev1.ResourceStorage: volSize},
					},
					StorageClassName: &c.cfg.StorageClass,
				},
			}},
		},
	}
	_, err = c.cs.AppsV1().StatefulSets(ns).Create(ctx, sts, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create statefulset: %w", err)
	}

	// 4. Service.
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns,
			Labels:    map[string]string{"app": name, "component": "mysql"},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"app": name},
			Ports: []corev1.ServicePort{{
				Name: "mysql",
				Port: 3306,
			}},
		},
	}
	_, err = c.cs.CoreV1().Services(ns).Create(ctx, svc, metav1.CreateOptions{})
	if err != nil && !isAlreadyExists(err) {
		return nil, fmt.Errorf("create service: %w", err)
	}

	// 5. Wait for readiness — MySQL's first boot (creating the db, running
	// the init script) is slower than Postgres's, so this gets a longer
	// timeout than CreateTenantPostgres's 120s.
	if err := c.WaitForStatefulSetReady(ctx, ns, name, 180); err != nil {
		return nil, fmt.Errorf("wait for mysql ready: %w", err)
	}

	host := fmt.Sprintf("%s.%s.svc.cluster.local:3306", name, ns)
	return &MySQLRef{
		Namespace:       ns,
		Service:         name,
		Port:            3306,
		RootPassword:    req.RootPassword,
		AnonPassword:    req.AnonPassword,
		ServicePassword: req.ServicePassword,
		DatabaseName:    req.DatabaseName,
		RootDSN:         fmt.Sprintf("root:%s@tcp(%s)/%s", req.RootPassword, host, req.DatabaseName),
		AnonDSN:         fmt.Sprintf("massi_anon:%s@tcp(%s)/%s", req.AnonPassword, host, req.DatabaseName),
		ServiceDSN:      fmt.Sprintf("massi_service:%s@tcp(%s)/%s", req.ServicePassword, host, req.DatabaseName),
	}, nil
}

// DeleteTenantMySQL removes the StatefulSet, Service, Secret, ConfigMap, and
// PVC for a tenant's MySQL instance. Best-effort, mirrors DeleteTenantPostgres.
func (c *Client) DeleteTenantMySQL(ctx context.Context, projectID, instanceName string) error {
	ns := TenantNamespaceName(projectID)
	name := "mysql-" + instanceName

	_ = c.cs.CoreV1().Services(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.AppsV1().StatefulSets(ns).Delete(ctx, name, metav1.DeleteOptions{})
	_ = c.cs.CoreV1().Secrets(ns).Delete(ctx, name+"-creds", metav1.DeleteOptions{})
	_ = c.cs.CoreV1().ConfigMaps(ns).Delete(ctx, name+"-init", metav1.DeleteOptions{})
	_ = c.cs.CoreV1().PersistentVolumeClaims(ns).Delete(ctx, "data-"+name+"-0", metav1.DeleteOptions{})
	return nil
}
