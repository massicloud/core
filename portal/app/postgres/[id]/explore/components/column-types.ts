export type ColumnTypeCategory = {
  label: string
  types: string[]
}

export const COLUMN_TYPE_CATEGORIES: ColumnTypeCategory[] = [
  {
    label: "Numbers",
    types: ["integer", "bigint", "smallint", "decimal", "numeric", "serial", "bigserial"],
  },
  {
    label: "Text",
    types: ["text", "varchar", "char"],
  },
  {
    label: "Date & Time",
    types: ["timestamp", "timestamptz", "date", "time", "interval"],
  },
  {
    label: "Boolean",
    types: ["boolean"],
  },
  {
    label: "UUID",
    types: ["uuid"],
  },
  {
    label: "JSON",
    types: ["json", "jsonb"],
  },
  {
    label: "Arrays",
    types: ["text[]", "integer[]", "uuid[]", "jsonb[]"],
  },
  {
    label: "Other",
    types: ["bytea", "inet"],
  },
]

export function getTypeBadgeClass(type: string): string {
  const normalized = type.toLowerCase().replace(/\s+/g, " ").trim()
  const base = normalized.endsWith("[]") ? normalized.slice(0, -2).trim() : normalized

  if (["integer","int","int2","int4","int8","bigint","smallint","serial","bigserial","numeric","decimal","float4","float8","real","double precision"].includes(base)) {
    return "bg-[#1D3461] text-[#3B82F6] border-[#1D3461]"
  }
  if (["text","varchar","character varying","char","character","bpchar"].includes(base) || base.startsWith("varchar")) {
    return "bg-[#14291E] text-[#22C55E] border-[#14291E]"
  }
  if (["boolean","bool"].includes(base)) {
    return "bg-[#2D2510] text-[#EAB308] border-[#2D2510]"
  }
  if (["timestamp","timestamptz","timestamp with time zone","timestamp without time zone","date","time","timetz","interval"].includes(base)) {
    return "bg-[#2D1A4A] text-[#A855F7] border-[#2D1A4A]"
  }
  if (base === "uuid") {
    return "bg-[#2D1E10] text-[#F97316] border-[#2D1E10]"
  }
  if (["json","jsonb"].includes(base)) {
    return "bg-[#2D1048] text-[#EC4899] border-[#2D1048]"
  }
  if (normalized.endsWith("[]")) {
    return "bg-[#0D2926] text-[#14B8A6] border-[#0D2926]"
  }
  // Custom enum or unknown
  return "bg-[#2D1F0A] text-[#F59E0B] border-[#2D1F0A]"
}

export const SQL_TYPES = new Set(
  COLUMN_TYPE_CATEGORIES.flatMap((category) => category.types)
)

/** True for array types like "text[]", "integer[]" */
export function isArrayType(type: string): boolean {
  return type.trim().toLowerCase().endsWith("[]")
}

const BUILT_IN_TYPES = new Set([
  "integer","int","int2","int4","int8","bigint","smallint","serial","bigserial",
  "numeric","decimal","float4","float8","real","double precision",
  "text","varchar","char","character varying","character","bpchar",
  "boolean","bool",
  "timestamp","timestamptz","timestamp with time zone","timestamp without time zone",
  "date","time","timetz","interval",
  "uuid","json","jsonb","bytea","inet","cidr","macaddr","xml","bit","varbit",
  "money","oid","void","name",
])

/** True when the type is not a known built-in — likely a user-defined enum */
export function isEnumType(type: string): boolean {
  const base = type.toLowerCase().replace("[]", "").trim()
  return !BUILT_IN_TYPES.has(base)
}
