import { ingredientMap } from '../data/ingredientMap'
import type { InventoryItem } from '../types'

/**
 * Extracts the keyword from a product name using the same logic as
 * TjekService.extractKeyword: the longest word with ≥5 letter characters
 * wins; later word wins on tie (product type > brand).
 */
export function extractKeyword(name: string): string {
  const words = name.split(/\s+/)
  let best = ''
  let bestLen = 0
  for (const word of words) {
    const letterCount = [...word].filter(c => /\p{L}/u.test(c)).length
    if (letterCount >= 5 && letterCount >= bestLen) {
      best = word
      bestLen = letterCount
    }
  }
  return best.toLowerCase()
}

/**
 * Maps inventory items to English ingredient names for TheMealDB searches.
 *
 * For each active item (consumptionLevel > 0):
 *   1. Try the full normalized name against ingredientMap
 *   2. Try the extracted keyword against ingredientMap
 *
 * Returns a deduplicated list of matched English ingredient names.
 * Items with no mapping are silently skipped.
 */
export function extractIngredients(items: InventoryItem[]): string[] {
  const found = new Set<string>()

  for (const item of items) {
    if (item.consumptionLevel <= 0) continue
    const rawName = item.name
    if (!rawName) continue

    const fullKey  = rawName.toLowerCase().trim()
    const keyword  = extractKeyword(rawName)

    const match =
      ingredientMap[fullKey] ??
      ingredientMap[keyword]

    if (match) found.add(match)
  }

  return [...found]
}
