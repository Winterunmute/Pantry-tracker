import type { Location } from '../types'
import { namesMatch } from './nameMatch'

const STORAGE_KEY = 'pantry-location-memory'

type MemoryMap = Record<string, Location>

function load(): MemoryMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(map: MemoryMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function rememberLocation(productName: string | null | undefined, location: Location) {
  if (!productName) return
  const key = productName.toLowerCase().trim()
  const map = load()
  map[key] = location
  save(map)
}

/** Returns a remembered location for the given product name, or null if none found. */
export function lookupLocation(productName: string | null | undefined): Location | null {
  if (!productName) return null
  const map = load()
  const normalised = productName.toLowerCase().trim()

  // 1. Exact match
  if (map[normalised]) return map[normalised]

  // 2. Keyword match — compare words with suffix-aware matching
  const match = Object.entries(map).find(([key]) => namesMatch(normalised, key))
  if (match) return match[1]

  return null
}
