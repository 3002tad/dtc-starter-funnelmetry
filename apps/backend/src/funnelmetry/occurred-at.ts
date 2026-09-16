export function normalizeOccurredAt(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString()
  return null
}
