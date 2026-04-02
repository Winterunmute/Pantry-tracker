/**
 * Checks whether two individual words are similar enough to count as a match.
 *
 * Handles Scandinavian compound words (e.g. "lättmjölk" / "mellanmjölk")
 * by checking shared suffixes — both words end with "mjölk" (5 chars).
 *
 * Match rules (any one sufficient):
 *   1. Identical
 *   2. One contains the other as a substring
 *   3. They share a common suffix of ≥ 4 characters
 */
function wordOverlap(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const maxLen = Math.min(a.length, b.length)
  for (let len = maxLen; len >= 4; len--) {
    if (a.slice(-len) === b.slice(-len)) return true
  }
  return false
}

const norm  = (s: string) => s.toLowerCase().trim()
const words = (s: string) => norm(s).split(/\s+/).filter((w) => w.length > 2)

/**
 * Returns true when two product names are considered the same product type.
 *
 * Compares individual words from each name against each other using
 * `wordOverlap`, so "Garant Lättmjölk" matches "Arla Mellanmjölk" via
 * the shared suffix "mjölk".
 */
export function namesMatch(a: string, b: string): boolean {
  const wa = words(a)
  const wb = words(b)
  return wa.some((w1) => wb.some((w2) => wordOverlap(w1, w2)))
}
