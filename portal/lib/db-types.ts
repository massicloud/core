const TYPE_COMPAT: Record<string, string[]> = {
  integer:   ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],
  smallint:  ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],
  bigint:    ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],
  serial:    ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],
  bigserial: ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],
  int2:      ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],
  int4:      ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],
  int8:      ["integer","smallint","bigint","serial","bigserial","int2","int4","int8"],

  text:    ["text","varchar","char","bpchar"],
  varchar: ["text","varchar","char","bpchar"],
  char:    ["text","varchar","char","bpchar"],
  bpchar:  ["text","varchar","char","bpchar"],

  uuid: ["uuid"],

  timestamp:   ["timestamp","timestamptz"],
  timestamptz: ["timestamp","timestamptz"],

  numeric: ["numeric","decimal","float4","float8","real"],
  decimal: ["numeric","decimal","float4","float8","real"],
  float4:  ["numeric","decimal","float4","float8","real"],
  float8:  ["numeric","decimal","float4","float8","real"],
  real:    ["numeric","decimal","float4","float8","real"],

  boolean: ["boolean","bool"],
  bool:    ["boolean","bool"],

  date: ["date"],
  time: ["time","timetz"],
  timetz: ["time","timetz"],

  json:  ["json","jsonb"],
  jsonb: ["json","jsonb"],
}

export function getCompatibleTypes(type: string): string[] {
  return TYPE_COMPAT[type.toLowerCase()] ?? [type.toLowerCase()]
}

export function isTypeCompatible(sourceType: string, targetType: string): boolean {
  return getCompatibleTypes(sourceType).includes(targetType.toLowerCase())
}
