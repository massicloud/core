export { createClient, MassiCloudClient } from './client'
export { AuthClient } from './auth'
export { RESTClient } from './rest'
export { QueryBuilder } from './rest/builder'
export { StorageClient, StorageBucketApi } from './storage'
export { MassiCloudError, isMassiCloudError } from './errors'

export type {
  MassiCloudConfig,
  AuthConfig,
  Session,
  User,
  AuthEvent,
  AuthChangeCallback,
  SessionStorage,
  MassiResponse,
  MassiError,
} from './types'

export type { Filter, FilterOperator } from './rest/filters'
export type { StorageObject, ListObjectsResult, SignedUrlResponse } from './storage'
