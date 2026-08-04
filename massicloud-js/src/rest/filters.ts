/**
 * PostgREST filter operators.
 */
export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike' | 'is' | 'in' | 'cs' | 'cd'
  | 'sl' | 'sr' | 'nxl' | 'nxr' | 'adj' | 'ov'
  | 'fts' | 'plfts' | 'phfts' | 'wfts'

export interface Filter {
  column: string
  operator: FilterOperator
  value: unknown
}

/** Serialise a filter to a PostgREST query string pair [column, value]. */
export function serializeFilter(f: Filter): [string, string] {
  let val: string
  if (f.operator === 'in') {
    const arr = Array.isArray(f.value) ? f.value : [f.value]
    val = `in.(${arr.map(encodePostgRESTValue).join(',')})`
  } else if (f.value === null) {
    val = `${f.operator}.null`
  } else {
    val = `${f.operator}.${encodePostgRESTValue(f.value)}`
  }
  return [f.column, val]
}

function encodePostgRESTValue(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') {
    if (v.includes(',') || v.includes('(') || v.includes(')')) {
      return `"${v.replace(/"/g, '\\"')}"`
    }
    return v
  }
  return String(v)
}
