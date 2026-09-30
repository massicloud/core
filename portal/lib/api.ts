import axios from "axios";
import { getToken, removeToken } from "./auth";
import type {
  APIKey,
  APIKeyType,
  APIKeyWithSecret,
  Backup,
  Bucket,
  CreateInstanceForStageRequest,
  CreateInstanceRequest,
  CreateProjectRequest,
  CreateStageRequest,
  HealthResponse,
  Instance,
  ListObjectsResult,
  LoginResponse,
  MongoInstance,
  PresignResponse,
  Project,
  ProjectWithKeys,
  SchemaPreset,
  Stage,
  StorageObject,
  User,
} from "@/types";

// "||" (not "??") is deliberate: the Dockerfile's `ARG NEXT_PUBLIC_API_URL`
// resolves to an empty string (not undefined) when --build-arg isn't passed
// at image-build time, and "??" only falls back on null/undefined — it lets
// "" straight through, silently turning every API call into a same-origin
// relative request. This has broken prod three times from a missed
// --build-arg flag; don't revert it back to "??".
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const API_URL_STORAGE_KEY = "massicloud-api-url";

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(API_URL_STORAGE_KEY);
    if (stored && stored.trim()) {
      return normalizeBaseUrl(stored);
    }
  }

  return normalizeBaseUrl(DEFAULT_API_URL);
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(API_URL_STORAGE_KEY, normalizeBaseUrl(url));
  }
}

// Create axios instance with interceptors
const api = axios.create({
  baseURL: DEFAULT_API_URL,
});

// Request interceptor to add auth header
api.interceptors.request.use((config) => {
  // Update baseURL dynamically
  config.baseURL = getApiBaseUrl();

  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Redirect everywhere except the login page itself, where a 401 is a
      // normal "wrong credentials" response — let the form handle it inline.
      // Don't gate this on whether a token was present: if it's already
      // missing (cleared elsewhere, or never attached), that's still a dead
      // session and the user needs to be sent back to log in, not left on a
      // page where every request quietly 401s forever.
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        removeToken();
        const redirect = window.location.pathname + window.location.search;
        window.location.href = `/login?reason=expired&redirect=${encodeURIComponent(redirect)}`;
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.error;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong";
}

// ============ AUTH ============

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/login", { email, password });
  return response.data;
}

export async function register(email: string, password: string, fullName: string): Promise<User> {
  const response = await api.post<User>("/auth/register", {
    email,
    password,
    full_name: fullName,
  });
  return response.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/auth/reset-password", { email });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password/confirm", { token, new_password: newPassword });
}

export async function me(): Promise<User> {
  const response = await api.get<User>("/auth/me");
  return response.data;
}

// ============ PROJECTS ============

export async function getProjects(): Promise<Project[]> {
  const response = await api.get("/projects");
  return response.data; // Not response.data.projects
}

export async function getProject(id: string): Promise<Project> {
  const response = await api.get<Project>(`/projects/${id}`);
  return response.data;
}

export async function createProject(req: CreateProjectRequest): Promise<ProjectWithKeys> {
  const response = await api.post<ProjectWithKeys>("/projects", req);
  return response.data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function updateProject(
  id: string,
  req: { name?: string; description?: string }
): Promise<Project> {
  const res = await api.patch<Project>(`/projects/${id}`, req);
  return res.data;
}

export async function listAPIKeys(projectId: string): Promise<APIKey[]> {
  const res = await api.get<APIKey[]>(`/projects/${projectId}/keys`);
  return res.data;
}

export async function rotateAPIKey(
  projectId: string,
  type: APIKeyType
): Promise<APIKeyWithSecret> {
  const res = await api.post<APIKeyWithSecret>(
    `/projects/${projectId}/keys/${type}/rotate`
  );
  return res.data;
}

// ============ POSTGRES ============

export async function getPostgresInstances(projectId?: string): Promise<Instance[]> {
  if (projectId) {
    const response = await api.get<Instance[]>("/postgres", {
      params: { project_id: projectId },
    });
    return response.data;
  }
  return [];
}

export async function createPostgresInstance(req: CreateInstanceRequest): Promise<Instance> {
  const response = await api.post<Instance>("/postgres", req);
  return response.data;
}

export async function deletePostgresInstance(id: string): Promise<void> {
  await api.delete(`/postgres/${id}`);
}

// ============ REDIS ============

export async function getRedisInstances(projectId?: string): Promise<Instance[]> {
  if (projectId) {
    const response = await api.get<Instance[]>("/redis", {
      params: { project_id: projectId },
    });
    return response.data;
  }
  return [];
}

export async function createRedisInstance(req: CreateInstanceRequest): Promise<Instance> {
  const response = await api.post<Instance>("/redis", req);
  return response.data;
}

export async function deleteRedisInstance(id: string): Promise<void> {
  await api.delete(`/redis/${id}`);
}

// ============ MONGO ============
// No create call here — unlike this module's postgres/redis functions above
// (which POST to endpoints main.go doesn't actually register), instance
// creation for every type goes through the stage-based
// addInstanceToStage() below, the only creation endpoint that exists.

export async function getMongoInstances(projectId?: string): Promise<MongoInstance[]> {
  if (projectId) {
    const response = await api.get<MongoInstance[]>("/mongo", {
      params: { project_id: projectId },
    });
    return response.data;
  }
  return [];
}

export async function deleteMongoInstance(id: string): Promise<void> {
  await api.delete(`/mongo/${id}`);
}

// ============ HEALTH ============

export async function getHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>("/health");
  return response.data;
}

// ============ STORAGE ============

export async function getBuckets(projectId: string): Promise<Bucket[]> {
  const res = await api.get<Bucket[]>("/storage/buckets", {
    params: { project_id: projectId },
  });
  return res.data;
}

export async function createBucket(req: {
  name: string;
  project_id: string;
  public: boolean;
}): Promise<Bucket> {
  const res = await api.post<Bucket>("/storage/buckets", req);
  return res.data;
}

export async function deleteBucket(name: string): Promise<void> {
  await api.delete(`/storage/buckets/${name}`);
}

export async function renameBucket(
  currentName: string,
  newName: string
): Promise<Bucket> {
  const res = await api.patch<Bucket>(`/storage/buckets/${currentName}`, {
    name: newName,
  });
  return res.data;
}

export async function updateBucketPolicy(
  name: string,
  isPublic: boolean
): Promise<void> {
  await api.put(`/storage/buckets/${name}/policy`, { public: isPublic });
}

export async function listObjects(
  bucket: string,
  prefix = ""
): Promise<ListObjectsResult> {
  const res = await api.get<ListObjectsResult>(
    `/storage/buckets/${bucket}/objects`,
    { params: { prefix } }
  );
  return res.data;
}

export async function uploadObject(
  bucket: string,
  file: File,
  prefix?: string,
  onProgress?: (percent: number) => void
): Promise<StorageObject> {
  const form = new FormData();
  form.append("file", file);
  if (prefix) form.append("prefix", prefix);

  const res = await api.post<StorageObject>(
    `/storage/buckets/${bucket}/objects`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }
  );
  return res.data;
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await api.delete(
    `/storage/buckets/${bucket}/objects/${encodeURIComponent(key)}`
  );
}

export async function presignObject(
  bucket: string,
  key: string,
  expiresInSeconds = 3600
): Promise<PresignResponse> {
  const res = await api.post<PresignResponse>(
    `/storage/buckets/${bucket}/presign`,
    { key, expires_in_seconds: expiresInSeconds }
  );
  return res.data;
}

// ============ BACKUPS ============

export async function listBackups(instanceId: string): Promise<Backup[]> {
  const res = await api.get<Backup[]>(`/postgres/${instanceId}/backups`);
  return res.data;
}

export async function createBackup(instanceId: string): Promise<void> {
  await api.post(`/postgres/${instanceId}/backups`);
}

export async function deleteBackup(
  instanceId: string,
  backupId: string
): Promise<void> {
  await api.delete(`/postgres/${instanceId}/backups/${backupId}`);
}

export async function restoreBackup(
  instanceId: string,
  backupId: string,
  newName: string,
  memoryMB: number
): Promise<{ status: string; new_instance_id: string }> {
  const res = await api.post(
    `/postgres/${instanceId}/backups/${backupId}/restore`,
    { backup_id: backupId, new_name: newName, memory_mb: memoryMB }
  );
  return res.data;
}

export async function updateBackupSettings(
  instanceId: string,
  settings: { backup_schedule: string; retention_days: number }
): Promise<void> {
  await api.put(`/postgres/${instanceId}/backup-settings`, settings);
}

// ============ STAGES ============

export async function listStages(projectId: string): Promise<Stage[]> {
  const res = await api.get(`/projects/${projectId}/stages`)
  return res.data
}

export async function createStage(
  projectId: string,
  body: CreateStageRequest
): Promise<Stage> {
  const res = await api.post(`/projects/${projectId}/stages`, body)
  return res.data
}

export async function deleteStage(projectId: string, stageName: string): Promise<void> {
  await api.delete(`/projects/${projectId}/stages/${stageName}`)
}

export async function setStageProtected(
  projectId: string,
  stageName: string,
  protectedFlag: boolean
): Promise<void> {
  await api.patch(`/projects/${projectId}/stages/${stageName}/protected`, {
    protected: protectedFlag,
  })
}

export async function addInstanceToStage(
  projectId: string,
  stageName: string,
  body: CreateInstanceForStageRequest
): Promise<Instance> {
  const res = await api.post(`/projects/${projectId}/stages/${stageName}/instances`, body)
  return res.data
}

export async function removeInstanceFromStage(
  projectId: string,
  stageName: string,
  instanceName: string
): Promise<void> {
  await api.delete(`/projects/${projectId}/stages/${stageName}/instances/${instanceName}`)
}

export async function listSchemaPresets(): Promise<SchemaPreset[]> {
  const res = await api.get('/schema-presets')
  return res.data
}

// Export the api instance for db-api to use
export { api };
