import { AxiosError } from "axios"
import { api } from "./api"
import type {
  CreateMongoIndexRequest,
  MongoCollection,
  MongoDocumentsResult,
  MongoIndex,
  MongoQueryResult,
} from "@/types"

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || error.response?.data?.message || error.message || "API error"
  }
  return "An unexpected error occurred"
}

// ============ COLLECTIONS ============

export async function getMongoCollections(instanceId: string): Promise<MongoCollection[]> {
  try {
    const res = await api.get(`/mongo/${instanceId}/collections`)
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function createMongoCollection(instanceId: string, name: string): Promise<void> {
  try {
    await api.post(`/mongo/${instanceId}/collections`, { name })
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function dropMongoCollection(instanceId: string, name: string): Promise<void> {
  try {
    await api.delete(`/mongo/${instanceId}/collections/${encodeURIComponent(name)}`)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ DOCUMENTS ============

export interface GetMongoDocumentsParams {
  limit?: number
  skip?: number
  sort?: string // "field:asc" | "field:desc"
  filter?: string // raw JSON string
}

export async function getMongoDocuments(
  instanceId: string,
  collection: string,
  params: GetMongoDocumentsParams = {}
): Promise<MongoDocumentsResult> {
  try {
    const res = await api.get(`/mongo/${instanceId}/collections/${encodeURIComponent(collection)}/documents`, {
      params,
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function insertMongoDocument(
  instanceId: string,
  collection: string,
  document: Record<string, unknown>
): Promise<{ inserted_id: string }> {
  try {
    const res = await api.post(
      `/mongo/${instanceId}/collections/${encodeURIComponent(collection)}/documents`,
      document
    )
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function updateMongoDocument(
  instanceId: string,
  collection: string,
  docId: string,
  fields: Record<string, unknown>
): Promise<void> {
  try {
    await api.patch(
      `/mongo/${instanceId}/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(docId)}`,
      fields
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function deleteMongoDocument(
  instanceId: string,
  collection: string,
  docId: string
): Promise<void> {
  try {
    await api.delete(
      `/mongo/${instanceId}/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(docId)}`
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ INDEXES ============

export async function getMongoIndexes(instanceId: string, collection: string): Promise<MongoIndex[]> {
  try {
    const res = await api.get(`/mongo/${instanceId}/collections/${encodeURIComponent(collection)}/indexes`)
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function createMongoIndex(
  instanceId: string,
  collection: string,
  req: CreateMongoIndexRequest
): Promise<void> {
  try {
    await api.post(`/mongo/${instanceId}/collections/${encodeURIComponent(collection)}/indexes`, req)
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

export async function dropMongoIndex(instanceId: string, collection: string, indexName: string): Promise<void> {
  try {
    await api.delete(
      `/mongo/${instanceId}/collections/${encodeURIComponent(collection)}/indexes/${encodeURIComponent(indexName)}`
    )
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}

// ============ QUERY CONSOLE ============

export async function runMongoQuery(
  instanceId: string,
  command: Record<string, unknown>
): Promise<MongoQueryResult> {
  try {
    const res = await api.post(`/mongo/${instanceId}/query`, { command })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error))
  }
}
