import { normalizeOccurredAt } from "../occurred-at"

describe("normalizeOccurredAt", () => {
  it("converts a Medusa Date value to the ISO string required by the Source contract", () => {
    expect(normalizeOccurredAt(new Date("2026-09-16T14:38:59.830Z"))).toBe("2026-09-16T14:38:59.830Z")
  })

  it("keeps an existing non-empty timestamp string and rejects unsupported values", () => {
    expect(normalizeOccurredAt(" 2026-09-16T14:38:59.830Z ")).toBe("2026-09-16T14:38:59.830Z")
    expect(normalizeOccurredAt(new Date("invalid"))).toBeNull()
    expect(normalizeOccurredAt(undefined)).toBeNull()
  })
})
