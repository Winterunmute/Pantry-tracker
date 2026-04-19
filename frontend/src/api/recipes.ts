import apiClient from './client'

const MEALDB = 'https://www.themealdb.com/api/json/v1/1'

// ── TheMealDB types ───────────────────────────────────────────────────────────

export interface MealSummary {
  id: string
  name: string
  thumbnail: string
}

export interface MealIngredient {
  ingredient: string
  measure: string
}

export interface MealDetail extends MealSummary {
  category: string
  area: string
  instructions: string
  ingredients: MealIngredient[]
  youtubeUrl: string | null
  sourceUrl: string | null
  tags: string[]
  /** Which API provided this recipe. Defaults to 'mealdb' if absent. */
  source?: 'mealdb' | 'spoonacular'
  /** Spoonacular numeric ID — only present when source === 'spoonacular'. */
  spoonacularId?: number
}

// ── Personal recipe types (backend) ──────────────────────────────────────────

export interface RecipeIngredient {
  name: string
  swedishName: string | null
  amount: string
}

export interface PersonalRecipe {
  id: string
  name: string
  description: string | null
  ingredients: RecipeIngredient[]
  instructions: string[]
  servings: number
  imageUrl: string | null
  sourceUrl: string | null
  sourceMealDbId: string | null
  tags: string[]
  createdAt: string
}

export interface CreatePersonalRecipePayload {
  name: string
  description?: string
  ingredients: RecipeIngredient[]
  instructions: string[]
  servings: number
  tags: string[]
  imageUrl?: string
}

// ── TheMealDB response shapes ─────────────────────────────────────────────────

interface RawMealSummary {
  idMeal: string
  strMeal: string
  strMealThumb: string
}

interface RawMealDetail extends RawMealSummary {
  strCategory: string
  strArea: string
  strInstructions: string
  strTags: string | null
  strYoutube: string | null
  strSource: string | null
  [key: string]: unknown // strIngredient1..20, strMeasure1..20
}

function parseSummary(r: RawMealSummary): MealSummary {
  return { id: r.idMeal, name: r.strMeal, thumbnail: r.strMealThumb }
}

function parseDetail(r: RawMealDetail): MealDetail {
  const ingredients: MealIngredient[] = []
  for (let i = 1; i <= 20; i++) {
    const ing = (r[`strIngredient${i}`] as string | null)?.trim()
    const mea = (r[`strMeasure${i}`] as string | null)?.trim()
    if (ing) ingredients.push({ ingredient: ing.toLowerCase(), measure: mea ?? '' })
  }
  return {
    id:           r.idMeal,
    name:         r.strMeal,
    thumbnail:    r.strMealThumb,
    category:     r.strCategory,
    area:         r.strArea,
    instructions: r.strInstructions,
    ingredients,
    youtubeUrl:   r.strYoutube || null,
    sourceUrl:    r.strSource  || null,
    tags:         r.strTags ? r.strTags.split(',').map(t => t.trim()).filter(Boolean) : [],
    source:       'mealdb',
  }
}

// ── TheMealDB API ─────────────────────────────────────────────────────────────

/** Find recipe summaries that use a given ingredient. */
export async function fetchMealsByIngredient(ingredient: string): Promise<MealSummary[]> {
  const slug = ingredient.replace(/\s+/g, '_')
  const res  = await fetch(`${MEALDB}/filter.php?i=${encodeURIComponent(slug)}`)
  const data = await res.json() as { meals: RawMealSummary[] | null }
  return (data.meals ?? []).map(parseSummary)
}

/** Search recipes by name. Returns full detail objects. */
export async function searchMealsByName(query: string): Promise<MealDetail[]> {
  const res  = await fetch(`${MEALDB}/search.php?s=${encodeURIComponent(query)}`)
  const data = await res.json() as { meals: RawMealDetail[] | null }
  return (data.meals ?? []).map(parseDetail)
}

/** Fetch full recipe detail by TheMealDB ID. */
export async function fetchMealDetail(id: string): Promise<MealDetail | null> {
  const res  = await fetch(`${MEALDB}/lookup.php?i=${encodeURIComponent(id)}`)
  const data = await res.json() as { meals: RawMealDetail[] | null }
  if (!data.meals?.length) return null
  return parseDetail(data.meals[0])
}

// ── Personal recipes API (backend) ────────────────────────────────────────────

export async function getPersonalRecipes(): Promise<PersonalRecipe[]> {
  const { data } = await apiClient.get<PersonalRecipe[]>('/api/recipes')
  return data
}

export async function createPersonalRecipe(payload: CreatePersonalRecipePayload): Promise<PersonalRecipe> {
  const { data } = await apiClient.post<PersonalRecipe>('/api/recipes', payload)
  return data
}

export async function deletePersonalRecipe(id: string): Promise<void> {
  await apiClient.delete(`/api/recipes/${id}`)
}

export async function importFromMealDb(mealDbId: string): Promise<PersonalRecipe> {
  const { data } = await apiClient.post<PersonalRecipe>('/api/recipes/import', { mealDbId })
  return data
}

export async function importFromSpoonacular(spoonacularId: number): Promise<PersonalRecipe> {
  const { data } = await apiClient.post<PersonalRecipe>('/api/recipes/import', {
    spoonacularId: String(spoonacularId),
  })
  return data
}

// ── Spoonacular API (via backend proxy) ───────────────────────────────────────

interface SpoonRawSummary {
  id: number
  title: string
  image: string
}

interface SpoonRawIngredient {
  name: string
  amount: number
  unit: string
}

interface SpoonRawStep {
  step: string
}

interface SpoonRawInstGroup {
  steps: SpoonRawStep[]
}

interface SpoonRawDetail extends SpoonRawSummary {
  servings: number
  readyInMinutes: number
  instructions: string | null
  analyzedInstructions: SpoonRawInstGroup[]
  extendedIngredients: SpoonRawIngredient[]
  cuisines: string[]
  dishTypes: string[]
  sourceUrl: string | null
}

interface SpoonSearchResponse {
  results: SpoonRawDetail[]
}

function parseSpoonDetail(r: SpoonRawDetail): MealDetail {
  const ingredients: MealIngredient[] = (r.extendedIngredients ?? []).map(i => ({
    ingredient: (i.name ?? '').toLowerCase(),
    measure:    `${i.amount ?? ''} ${i.unit ?? ''}`.trim(),
  }))

  let instructions = r.instructions ?? ''
  if (!instructions && r.analyzedInstructions?.length > 0) {
    instructions = r.analyzedInstructions[0].steps.map(s => s.step).join('\n')
  }

  return {
    id:            `spoon_${r.id}`,
    name:          r.title,
    thumbnail:     r.image,
    category:      r.dishTypes?.join(', ') ?? '',
    area:          r.cuisines?.join(', ') ?? '',
    instructions,
    ingredients,
    youtubeUrl:    null,
    sourceUrl:     r.sourceUrl ?? null,
    tags:          r.dishTypes ?? [],
    source:        'spoonacular',
    spoonacularId: r.id,
  }
}

/** Find recipes by ingredient list (returns summaries; use fetchSpoonacularDetail for full info). */
export async function fetchSpoonacularByIngredients(ingredients: string[]): Promise<MealSummary[]> {
  if (ingredients.length === 0) return []
  const csv = ingredients.map(i => encodeURIComponent(i)).join(',')
  console.log('[Spoonacular] findByIngredients →', csv)
  try {
    const { data } = await apiClient.get<SpoonRawSummary[]>(
      `/api/spoonacular/findByIngredients?ingredients=${csv}&number=20`,
    )
    console.log('[Spoonacular] findByIngredients ←', data?.length ?? 0, 'results')
    return (data ?? []).map(r => ({
      id:        `spoon_${r.id}`,
      name:      r.title,
      thumbnail: r.image,
    }))
  } catch (err) {
    console.warn('[Spoonacular] findByIngredients failed (quota or network):', err)
    return []
  }
}

/** Search recipes by name — returns full detail objects in one call. */
export async function searchSpoonacular(query: string): Promise<MealDetail[]> {
  console.log('[Spoonacular] search →', query)
  try {
    const { data } = await apiClient.get<SpoonSearchResponse>(
      `/api/spoonacular/search?query=${encodeURIComponent(query)}&number=20`,
    )
    console.log('[Spoonacular] search ←', data?.results?.length ?? 0, 'results', '| raw keys:', data ? Object.keys(data) : 'null')
    return (data?.results ?? []).map(parseSpoonDetail)
  } catch (err) {
    console.warn('[Spoonacular] search failed (quota or network):', err)
    return []
  }
}

/** Fetch full recipe detail by Spoonacular numeric ID. */
export async function fetchSpoonacularDetail(id: number): Promise<MealDetail | null> {
  try {
    const { data } = await apiClient.get<SpoonRawDetail>(`/api/spoonacular/recipe/${id}`)
    return parseSpoonDetail(data)
  } catch (err) {
    console.warn(`[Spoonacular] recipe/${id} failed:`, err)
    return null
  }
}
