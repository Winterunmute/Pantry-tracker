import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInventory, createItem } from '../api/inventory'
import {
  fetchMealsByIngredient,
  fetchMealDetail,
  searchMealsByName,
  fetchSpoonacularByIngredients,
  fetchSpoonacularDetail,
  searchSpoonacular,
  getPersonalRecipes,
  createPersonalRecipe,
  deletePersonalRecipe,
  importFromMealDb,
  importFromSpoonacular,
} from '../api/recipes'
import type {
  MealSummary,
  MealDetail,
  PersonalRecipe,
  CreatePersonalRecipePayload,
} from '../api/recipes'
import type { InventoryItem } from '../types'
import { extractIngredients } from '../utils/extractIngredients'

// ── Types ─────────────────────────────────────────────────────────────────────

type RecipeTab = 'inventory' | 'search' | 'saved'
type SortMode  = 'best' | 'most' | 'az'

interface RecipeWithCounts {
  detail:       MealDetail
  matchCount:   number   // how many user ingredients are present
  missingCount: number
  present:      string[]
  missing:      string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True when recipeIngredient is covered by the user's ingredient set. */
function ingredientPresent(recipeIng: string, userSet: Set<string>): boolean {
  const r = recipeIng.toLowerCase()
  for (const u of userSet) {
    const ul = u.toLowerCase()
    if (r === ul || r.includes(ul) || ul.includes(r)) return true
  }
  return false
}

function analyzeRecipe(detail: MealDetail, userSet: Set<string>): RecipeWithCounts {
  const present: string[] = []
  const missing: string[] = []
  for (const { ingredient } of detail.ingredients) {
    if (!ingredient) continue
    if (ingredientPresent(ingredient, userSet)) present.push(ingredient)
    else missing.push(ingredient)
  }
  return { detail, matchCount: present.length, missingCount: missing.length, present, missing }
}

function sortRecipes(recipes: RecipeWithCounts[], mode: SortMode): RecipeWithCounts[] {
  return [...recipes].sort((a, b) => {
    if (mode === 'best') return a.missingCount - b.missingCount
    if (mode === 'most') return b.matchCount  - a.matchCount
    return a.detail.name.localeCompare(b.detail.name, 'sv')
  })
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: 'mealdb' | 'spoonacular' }) {
  if (source === 'spoonacular') {
    return (
      <span className="bg-green-600/90 text-white text-xs font-medium rounded-full px-1.5 py-0.5 leading-tight">
        Spoonacular
      </span>
    )
  }
  return (
    <span className="bg-orange-500/90 text-white text-xs font-medium rounded-full px-1.5 py-0.5 leading-tight">
      MealDB
    </span>
  )
}

// ── Ingredient chips ──────────────────────────────────────────────────────────

function IngredientChips({ ingredients }: { ingredients: string[] }) {
  if (ingredients.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {ingredients.map(ing => (
        <span key={ing} className="bg-brand-50 border border-brand-200 text-brand-700 text-xs px-2 py-0.5 rounded-full">
          {ing}
        </span>
      ))}
    </div>
  )
}

// ── Recipe card ───────────────────────────────────────────────────────────────

interface RecipeCardProps {
  name:         string
  thumbnail:    string
  matchCount:   number
  missingCount: number
  missing:      string[]
  onOpen:       () => void
  onAddMissing?: () => void
  addMissingDone?: boolean
  badge?:       React.ReactNode
}

function RecipeCard({
  name, thumbnail, matchCount, missingCount, missing,
  onOpen, onAddMissing, addMissingDone, badge,
}: RecipeCardProps) {
  const shownMissing = missing.slice(0, 4)
  const extraMissing = missing.length - 4

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onOpen}
    >
      {/* Thumbnail */}
      <div className="relative">
        <img src={thumbnail} alt={name} className="w-full h-32 object-cover" loading="lazy" />
        {badge && <div className="absolute top-2 right-2">{badge}</div>}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{name}</p>

        {/* Match summary */}
        <div className="flex items-center gap-3 text-xs">
          {matchCount > 0 && (
            <span className="text-green-600 font-medium">✅ {matchCount} hemma</span>
          )}
          {missingCount > 0 && (
            <span className="text-orange-500 font-medium">🛒 {missingCount} saknas</span>
          )}
        </div>

        {/* Missing list */}
        {missing.length > 0 && (
          <p className="text-xs text-gray-400 leading-snug">
            {shownMissing.join(', ')}
            {extraMissing > 0 && ` +${extraMissing} till`}
          </p>
        )}

        {/* Add missing button */}
        {onAddMissing && missing.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onAddMissing() }}
            className={`w-full text-xs font-medium py-1.5 rounded-lg transition-colors ${
              addMissingDone
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
            }`}
          >
            {addMissingDone ? '✅ Tillagt' : '🛒 Lägg till saknade varor'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Instruction parser ────────────────────────────────────────────────────────

/**
 * Normalises instruction strings from any source into a clean string[].
 *
 * Spoonacular → HTML like "<ol><li>Cook pork…</li><li>Sauté…</li></ol>"
 *   → extract <li> text content via a temporary DOM element.
 *
 * TheMealDB → plain text block with \r\n or \n separators
 *   → split on newlines, filter empty chunks.
 *
 * Fallback → return the whole string as a single step.
 */
function parseInstructions(raw: string): string[] {
  if (!raw?.trim()) return []

  // HTML path — Spoonacular sends <ol>/<ul> with <li> elements
  if (raw.includes('<')) {
    const div = document.createElement('div')
    div.innerHTML = raw
    const items = Array.from(div.querySelectorAll('li'))
    if (items.length > 0) {
      return items
        .map(li => li.textContent?.trim() ?? '')
        .filter(Boolean)
    }
    // HTML but no <li> — strip all tags and fall through to text splitting
    const text = div.textContent ?? ''
    return text.split(/\n/).map(s => s.trim()).filter(Boolean)
  }

  // Plain text — split on paragraph breaks first, then single newlines
  const paragraphs = raw.split(/\r?\n\r?\n/).map(s => s.trim()).filter(Boolean)
  if (paragraphs.length > 1) return paragraphs

  return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
}

// ── Recipe detail view ────────────────────────────────────────────────────────

interface RecipeDetailViewProps {
  detail:          MealDetail
  userSet:         Set<string>
  onBack:          () => void
  onAddMissing:    (missing: string[]) => void
  addMissingDone:  boolean
  onSave?:         () => void
  saveDone?:       boolean
  isSaving?:       boolean
}

function RecipeDetailView({
  detail, userSet, onBack, onAddMissing, addMissingDone, onSave, saveDone, isSaving,
}: RecipeDetailViewProps) {
  const { present: _present, missing } = analyzeRecipe(detail, userSet)

  const steps = parseInstructions(detail.instructions)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-brand-600 font-medium hover:text-brand-700"
        >
          ← Tillbaka
        </button>
      </div>

      {/* Hero image */}
      <img src={detail.thumbnail} alt={detail.name} className="w-full h-48 object-cover rounded-xl" />

      {/* Title + actions */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-gray-900">{detail.name}</h2>
        <p className="text-xs text-gray-400">{detail.category} · {detail.area}</p>

        <div className="flex flex-wrap gap-2">
          {missing.length > 0 && (
            <button
              onClick={() => onAddMissing(missing)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                addMissingDone
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
              }`}
            >
              {addMissingDone ? '✅ Tillagt' : `🛒 Lägg till ${missing.length} saknade`}
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              disabled={saveDone || isSaving}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                saveDone
                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {saveDone ? '✅ Sparat' : isSaving ? 'Sparar…' : '❤️ Spara recept'}
            </button>
          )}
          {detail.youtubeUrl && (
            <a
              href={detail.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            >
              ▶ YouTube
            </a>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Ingredienser</h3>
        <ul className="space-y-1">
          {detail.ingredients.map(({ ingredient, measure }, i) => {
            const have = ingredientPresent(ingredient, userSet)
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`text-base ${have ? 'opacity-100' : 'opacity-30'}`}>
                  {have ? '✅' : '⬜'}
                </span>
                <span className={have ? 'text-gray-900' : 'text-gray-400'}>
                  {measure && <span className="font-medium">{measure} </span>}
                  {ingredient}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Instructions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Instruktioner</h3>
        {detail.instructions?.includes('<') ? (
          // HTML instructions (Spoonacular) — render directly, style the list
          <div
            className="text-sm text-gray-700 [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-2 [&_li]:leading-relaxed [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: detail.instructions }}
          />
        ) : (
          // Plain-text instructions (TheMealDB) — step-bubble rendering
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 w-5 h-5 bg-brand-100 text-brand-700 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {detail.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {detail.tags.map(tag => (
            <span key={tag} className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Personal recipe detail view ───────────────────────────────────────────────

function PersonalDetailView({
  recipe, userSet, onBack, onAddMissing, addMissingDone, onDelete,
}: {
  recipe: PersonalRecipe
  userSet: Set<string>
  onBack: () => void
  onAddMissing: (missing: string[]) => void
  addMissingDone: boolean
  onDelete: () => void
}) {
  const missing = recipe.ingredients
    .filter(i => !ingredientPresent(i.name, userSet))
    .map(i => i.name)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-brand-600 font-medium hover:text-brand-700">
          ← Tillbaka
        </button>
      </div>

      {recipe.imageUrl && (
        <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-48 object-cover rounded-xl" />
      )}

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{recipe.name}</h2>
            {recipe.description && <p className="text-xs text-gray-400 mt-0.5">{recipe.description}</p>}
          </div>
          <button
            onClick={onDelete}
            className="shrink-0 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
          >
            🗑️ Ta bort
          </button>
        </div>
        <p className="text-xs text-gray-400">
          {recipe.servings} portioner
          {recipe.tags.length > 0 && ' · ' + recipe.tags.join(', ')}
        </p>

        {missing.length > 0 && (
          <button
            onClick={() => onAddMissing(missing)}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              addMissingDone
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
            }`}
          >
            {addMissingDone ? '✅ Tillagt' : `🛒 Lägg till ${missing.length} saknade`}
          </button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Ingredienser</h3>
        <ul className="space-y-1">
          {recipe.ingredients.map((ing, i) => {
            const have = ingredientPresent(ing.name, userSet)
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`text-base ${have ? 'opacity-100' : 'opacity-30'}`}>{have ? '✅' : '⬜'}</span>
                <span className={have ? 'text-gray-900' : 'text-gray-400'}>
                  {ing.amount && <span className="font-medium">{ing.amount} </span>}
                  {ing.name}
                  {ing.swedishName && <span className="text-gray-400"> ({ing.swedishName})</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Instruktioner</h3>
        <ol className="space-y-3">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="shrink-0 w-5 h-5 bg-brand-100 text-brand-700 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ── Create recipe form ────────────────────────────────────────────────────────

function CreateRecipeForm({ onSave, onCancel }: { onSave: (p: CreatePersonalRecipePayload) => void; onCancel: () => void }) {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings]       = useState(4)
  const [tags, setTags]               = useState('')
  const [ingredients, setIngredients] = useState<{ amount: string; name: string }[]>([{ amount: '', name: '' }])
  const [instructions, setInstructions] = useState<string[]>([''])

  function addIngredient() { setIngredients(prev => [...prev, { amount: '', name: '' }]) }
  function removeIngredient(i: number) { setIngredients(prev => prev.filter((_, idx) => idx !== i)) }
  function setIngField(i: number, field: 'amount' | 'name', val: string) {
    setIngredients(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }

  function addStep() { setInstructions(prev => [...prev, '']) }
  function removeStep(i: number) { setInstructions(prev => prev.filter((_, idx) => idx !== i)) }
  function setStep(i: number, val: string) {
    setInstructions(prev => prev.map((s, idx) => idx === i ? val : s))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CreatePersonalRecipePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      servings,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      ingredients: ingredients
        .filter(i => i.name.trim())
        .map(i => ({ name: i.name.trim(), amount: i.amount.trim(), swedishName: null })),
      instructions: instructions.filter(s => s.trim()),
    }
    onSave(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <h3 className="font-semibold text-gray-900">Skapa eget recept</h3>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Namn *</label>
        <input
          required value={name} onChange={e => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Receptnamn"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Portioner</label>
          <input
            type="number" min={1} max={20} value={servings} onChange={e => setServings(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Taggar (kommasep.)</label>
          <input
            value={tags} onChange={e => setTags(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="pasta, snabb"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Beskrivning</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Valfri kort beskrivning"
        />
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 font-medium">Ingredienser</label>
          <button type="button" onClick={addIngredient} className="text-xs text-brand-600 font-medium hover:text-brand-700">
            + Lägg till
          </button>
        </div>
        <div className="space-y-2">
          {ingredients.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={row.amount} onChange={e => setIngField(i, 'amount', e.target.value)}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="Mängd"
              />
              <input
                value={row.name} onChange={e => setIngField(i, 'name', e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="Ingrediens (engelska)"
              />
              {ingredients.length > 1 && (
                <button type="button" onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 font-medium">Steg</label>
          <button type="button" onClick={addStep} className="text-xs text-brand-600 font-medium hover:text-brand-700">
            + Lägg till steg
          </button>
        </div>
        <div className="space-y-2">
          {instructions.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="shrink-0 w-5 h-5 bg-gray-100 text-gray-500 rounded-full text-xs font-bold flex items-center justify-center mt-1.5">
                {i + 1}
              </span>
              <textarea
                value={step} onChange={e => setStep(i, e.target.value)} rows={2}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder={`Steg ${i + 1}`}
              />
              {instructions.length > 1 && (
                <button type="button" onClick={() => removeStep(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none mt-1.5">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 bg-brand-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
        >
          Spara recept
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-4 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Avbryt
        </button>
      </div>
    </form>
  )
}

// ── Sort control ──────────────────────────────────────────────────────────────

function SortControl({ mode, onChange }: { mode: SortMode; onChange: (m: SortMode) => void }) {
  const options: { value: SortMode; label: string }[] = [
    { value: 'best', label: 'Bäst match' },
    { value: 'most', label: 'Flest ingredienser' },
    { value: 'az',   label: 'A-Ö' },
  ]
  return (
    <div className="flex gap-1">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            mode === o.value
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-500 border-gray-200 hover:border-brand-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function RecipeGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-gray-100 rounded-xl overflow-hidden animate-pulse">
          <div className="h-32 bg-gray-200" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shared "add missing" logic hook ──────────────────────────────────────────

function useAddMissing(toast: (msg: string) => void) {
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const addMutation = useMutation({
    mutationFn: async (missing: string[]) => {
      await Promise.all(missing.map(name =>
        createItem({
          name,
          barcode: null,
          brand: null,
          quantity: 1,
          location: 'pantry',
          expiryDate: null,
          imageUrl: null,
          consumptionLevel: 0,
          isStaple: true,
          restockThreshold: 0.25,
        })
      ))
    },
    onSuccess: (_, missing) => {
      toast(`${missing.length} varor tillagda på inköpslistan`)
    },
  })

  function addMissing(recipeKey: string, missing: string[]) {
    if (addedKeys.has(recipeKey)) return
    setAddedKeys(prev => new Set([...prev, recipeKey]))
    addMutation.mutate(missing)
  }

  return { addMissing, addedKeys }
}

// ── Inventory tab ─────────────────────────────────────────────────────────────

function InventoryTab({
  items,
  userSet,
  onOpenDetail,
  addMissing,
  addedKeys,
}: {
  items:        InventoryItem[]
  userSet:      Set<string>
  onOpenDetail: (detail: MealDetail) => void
  addMissing:   (key: string, missing: string[]) => void
  addedKeys:    Set<string>
}) {
  const ingredients = useMemo(() => extractIngredients(items), [items])
  const [sort, setSort] = useState<SortMode>('best')

  // Phase 1: fetch summaries per ingredient from both sources (up to 8 ingredients)
  const topIngredients = ingredients.slice(0, 8)

  const filterQueries = useQueries({
    queries: topIngredients.map(ing => ({
      queryKey: ['mealsByIngredient', ing],
      queryFn: () => fetchMealsByIngredient(ing),
      staleTime: 10 * 60 * 1000,
    })),
  })

  const spoonFilterQueries = useQueries({
    queries: topIngredients.map(ing => ({
      queryKey: ['spoonByIngredient', ing],
      queryFn: () => fetchSpoonacularByIngredients([ing]),
      staleTime: 10 * 60 * 1000,
    })),
  })

  const phase1Done = topIngredients.length > 0
    && filterQueries.every(q => !q.isLoading)
    && spoonFilterQueries.every(q => !q.isLoading)

  // Aggregate unique meals from both sources by frequency, take top 20
  const topMeals = useMemo<MealSummary[]>(() => {
    if (!phase1Done) return []
    const freq = new Map<string, { meal: MealSummary; count: number }>()
    for (const q of [...filterQueries, ...spoonFilterQueries]) {
      for (const meal of (q.data ?? [])) {
        const existing = freq.get(meal.id)
        if (existing) existing.count++
        else freq.set(meal.id, { meal, count: 1 })
      }
    }
    return [...freq.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(v => v.meal)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase1Done,
      filterQueries.map(q => q.dataUpdatedAt).join(','),
      spoonFilterQueries.map(q => q.dataUpdatedAt).join(',')])

  // Phase 2: fetch full details — dispatch to MealDB or Spoonacular by id prefix
  const detailQueries = useQueries({
    queries: topMeals.map(meal => ({
      queryKey: ['recipeDetail', meal.id],
      queryFn: () => meal.id.startsWith('spoon_')
        ? fetchSpoonacularDetail(parseInt(meal.id.replace('spoon_', ''), 10))
        : fetchMealDetail(meal.id),
      staleTime: Infinity,
      enabled: phase1Done,
    })),
  })

  const detailsDone = detailQueries.length > 0 && detailQueries.every(q => !q.isLoading)

  const analyzed = useMemo<RecipeWithCounts[]>(() => {
    if (!detailsDone) return []
    const details = detailQueries.map(q => q.data).filter((d): d is MealDetail => d != null)
    const mealdb = details.filter(d => d.source !== 'spoonacular').length
    const spoon  = details.filter(d => d.source === 'spoonacular').length
    console.log('[Inventory] details fetched — mealdb:', mealdb, '· spoonacular:', spoon)
    // Deduplicate by lowercased name (keep first occurrence)
    const seen = new Set<string>()
    return details
      .filter(d => { const k = d.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
      .map(d => analyzeRecipe(d, userSet))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsDone, detailQueries.map(q => q.dataUpdatedAt).join(','), userSet])

  const sorted = useMemo(() => sortRecipes(analyzed, sort), [analyzed, sort])

  if (ingredients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <p className="text-4xl mb-3">🥫</p>
        <p className="text-sm font-medium">Inga matchade ingredienser</p>
        <p className="text-xs mt-1 max-w-xs">
          Scanna in varor i ditt skafferi så hittar vi recept som matchar.
        </p>
      </div>
    )
  }

  if (!phase1Done || (phase1Done && !detailsDone)) {
    return (
      <div className="space-y-4">
        <IngredientChips ingredients={ingredients} />
        <RecipeGridSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <IngredientChips ingredients={ingredients} />

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <p className="text-3xl mb-2">🍳</p>
          <p className="text-sm">Inga recept hittades med dina ingredienser</p>
        </div>
      ) : (
        <>
          <SortControl mode={sort} onChange={setSort} />
          <div className="grid grid-cols-2 gap-3">
            {sorted.map(({ detail, matchCount, missingCount, missing }) => (
              <RecipeCard
                key={detail.id}
                name={detail.name}
                thumbnail={detail.thumbnail}
                matchCount={matchCount}
                missingCount={missingCount}
                missing={missing}
                onOpen={() => onOpenDetail(detail)}
                onAddMissing={() => addMissing(detail.id, missing)}
                addMissingDone={addedKeys.has(detail.id)}
                badge={<SourceBadge source={detail.source} />}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Search tab ────────────────────────────────────────────────────────────────

function SearchTab({
  userSet,
  onOpenDetail,
  addMissing,
  addedKeys,
}: {
  userSet:      Set<string>
  onOpenDetail: (detail: MealDetail) => void
  addMissing:   (key: string, missing: string[]) => void
  addedKeys:    Set<string>
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('best')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(t)
  }, [query])

  const { data: mealdbResults = [], isLoading: mealdbLoading } = useQuery({
    queryKey: ['searchMeals', debouncedQuery],
    queryFn: () => searchMealsByName(debouncedQuery),
    enabled: debouncedQuery.length > 1,
    staleTime: 5 * 60 * 1000,
  })

  const { data: spoonResults = [], isLoading: spoonLoading } = useQuery({
    queryKey: ['searchSpoon', debouncedQuery],
    queryFn: () => searchSpoonacular(debouncedQuery),
    enabled: debouncedQuery.length > 1,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = mealdbLoading || spoonLoading

  const analyzed = useMemo(() => {
    console.log('[Search] mealdb results:', mealdbResults.length, '· spoonacular results:', spoonResults.length)
    // Merge and deduplicate by lowercased name
    const seen = new Set<string>()
    const merged: MealDetail[] = []
    for (const d of [...mealdbResults, ...spoonResults]) {
      const k = d.name.toLowerCase()
      if (!seen.has(k)) { seen.add(k); merged.push(d) }
    }
    console.log('[Search] combined after dedup:', merged.length)
    return sortRecipes(merged.map(d => analyzeRecipe(d, userSet)), sort)
  }, [mealdbResults, spoonResults, userSet, sort])

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Sök recept… (t.ex. pasta, chicken)"
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />

      {debouncedQuery.length > 1 && isLoading && <RecipeGridSkeleton />}

      {!isLoading && debouncedQuery.length > 1 && analyzed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">Inga recept hittades för "{debouncedQuery}"</p>
        </div>
      )}

      {analyzed.length > 0 && (
        <>
          <SortControl mode={sort} onChange={setSort} />
          <div className="grid grid-cols-2 gap-3">
            {analyzed.map(({ detail, matchCount, missingCount, missing }) => (
              <RecipeCard
                key={detail.id}
                name={detail.name}
                thumbnail={detail.thumbnail}
                matchCount={matchCount}
                missingCount={missingCount}
                missing={missing}
                onOpen={() => onOpenDetail(detail)}
                onAddMissing={() => addMissing(detail.id, missing)}
                addMissingDone={addedKeys.has(detail.id)}
                badge={<SourceBadge source={detail.source} />}
              />
            ))}
          </div>
        </>
      )}

      {debouncedQuery.length <= 1 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm">Skriv ett recept- eller ingrediensnamn</p>
        </div>
      )}
    </div>
  )
}

// ── Saved tab ─────────────────────────────────────────────────────────────────

function SavedTab({
  userSet,
  onOpenSaved,
  addMissing,
  addedKeys,
}: {
  userSet:       Set<string>
  onOpenSaved:   (r: PersonalRecipe) => void
  addMissing:    (key: string, missing: string[]) => void
  addedKeys:     Set<string>
}) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['personalRecipes'],
    queryFn: getPersonalRecipes,
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: createPersonalRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalRecipes'] })
      setShowForm(false)
    },
  })

  if (isLoading) return <RecipeGridSkeleton />

  return (
    <div className="space-y-4">
      {showForm ? (
        <CreateRecipeForm
          onSave={payload => createMutation.mutate(payload)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full text-sm font-medium py-2.5 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 hover:bg-brand-50 transition-colors"
        >
          ➕ Skapa eget recept
        </button>
      )}

      {recipes.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <p className="text-4xl mb-3">❤️</p>
          <p className="text-sm font-medium">Inga sparade recept ännu</p>
          <p className="text-xs mt-1 max-w-xs">
            Spara recept från TheMealDB eller skapa egna.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {recipes.map(recipe => {
          const missing = recipe.ingredients
            .filter(i => !ingredientPresent(i.name, userSet))
            .map(i => i.name)
          const matchCount  = recipe.ingredients.length - missing.length
          const missingCount = missing.length
          return (
            <RecipeCard
              key={recipe.id}
              name={recipe.name}
              thumbnail={recipe.imageUrl ?? 'https://www.themealdb.com/images/category/miscellaneous.png'}
              matchCount={matchCount}
              missingCount={missingCount}
              missing={missing}
              onOpen={() => onOpenSaved(recipe)}
              onAddMissing={() => addMissing(recipe.id, missing)}
              addMissingDone={addedKeys.has(recipe.id)}
              badge={<span className="bg-pink-500 text-white text-xs rounded-full px-1.5 py-0.5">❤️</span>}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Recipes() {
  const queryClient = useQueryClient()
  const [tab, setTab]                           = useState<RecipeTab>('inventory')
  const [selectedMeal, setSelectedMeal]         = useState<MealDetail | null>(null)
  const [selectedSaved, setSelectedSaved]       = useState<PersonalRecipe | null>(null)
  const [toast, setToastMsg]                    = useState<string | null>(null)
  const [saveDoneIds, setSaveDoneIds]           = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving]                 = useState(false)
  const [addMissingDetailDone, setAddMissingDetailDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: items = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
    staleTime: 60_000,
  })

  const userSet = useMemo(
    () => new Set(extractIngredients(items)),
    [items]
  )

  function showToast(msg: string) {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 3000)
  }

  const { addMissing, addedKeys } = useAddMissing(showToast)

  function handleAddMissingFromDetail(missing: string[]) {
    if (!selectedMeal && !selectedSaved) return
    const key = selectedMeal?.id ?? selectedSaved!.id
    addMissing(key, missing)
    setAddMissingDetailDone(true)
  }

  async function handleSaveRecipe() {
    if (!selectedMeal || saveDoneIds.has(selectedMeal.id)) return
    setIsSaving(true)
    try {
      if (selectedMeal.source === 'spoonacular' && selectedMeal.spoonacularId != null) {
        await importFromSpoonacular(selectedMeal.spoonacularId)
      } else {
        await importFromMealDb(selectedMeal.id)
      }
      setSaveDoneIds(prev => new Set([...prev, selectedMeal.id]))
      queryClient.invalidateQueries({ queryKey: ['personalRecipes'] })
      showToast('Recept sparat!')
    } catch {
      showToast('Kunde inte spara receptet')
    } finally {
      setIsSaving(false)
    }
  }

  function handleDeleteSaved() {
    if (!selectedSaved) return
    deletePersonalRecipe(selectedSaved.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['personalRecipes'] })
      setSelectedSaved(null)
      showToast('Recept borttaget')
    })
  }

  function handleOpenDetail(detail: MealDetail) {
    setSelectedMeal(detail)
    setSelectedSaved(null)
    setAddMissingDetailDone(false)
  }

  function handleOpenSaved(recipe: PersonalRecipe) {
    setSelectedSaved(recipe)
    setSelectedMeal(null)
    setAddMissingDetailDone(false)
  }

  function handleBack() {
    setSelectedMeal(null)
    setSelectedSaved(null)
  }

  async function handleCopyPrompt() {
    const inventory = await getInventory()
    const ingredients = inventory
      .filter(i => i.location?.toLowerCase() !== 'sundries')
      .map(i => `${i.quantity}x ${i.name}`)
      .join(', ')
    const prompt = `Jag har följande ingredienser hemma: ${ingredients}. Vad kan jag laga för mat? Ge mig några recept.`
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs: { value: RecipeTab; label: string }[] = [
    { value: 'inventory', label: 'Mina ingredienser 🥫' },
    { value: 'search',    label: 'Sök recept 🔍' },
    { value: 'saved',     label: 'Mina recept ❤️' },
  ]

  // ── Render detail view ──────────────────────────────────────────────────────
  if (selectedMeal) {
    return (
      <div className="py-4 pb-24 space-y-4">
        <RecipeDetailView
          detail={selectedMeal}
          userSet={userSet}
          onBack={handleBack}
          onAddMissing={handleAddMissingFromDetail}
          addMissingDone={addMissingDetailDone}
          onSave={handleSaveRecipe}
          saveDone={saveDoneIds.has(selectedMeal.id)}
          isSaving={isSaving}
        />
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 animate-fade-in">
            {toast}
          </div>
        )}
      </div>
    )
  }

  if (selectedSaved) {
    return (
      <div className="py-4 pb-24 space-y-4">
        <PersonalDetailView
          recipe={selectedSaved}
          userSet={userSet}
          onBack={handleBack}
          onAddMissing={handleAddMissingFromDetail}
          addMissingDone={addMissingDetailDone}
          onDelete={handleDeleteSaved}
        />
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
            {toast}
          </div>
        )}
      </div>
    )
  }

  // ── Render main page ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 py-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recept 🍳</h1>
          <p className="text-sm text-gray-500 mt-1">Hitta recept baserat på vad du har hemma.</p>
        </div>
        <button
          onClick={handleCopyPrompt}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            copied
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
        >
          {copied ? '✅ Kopierat!' : '📋 Kopiera ingredienser'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.value
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'inventory' && (
        <InventoryTab
          items={items}
          userSet={userSet}
          onOpenDetail={handleOpenDetail}
          addMissing={addMissing}
          addedKeys={addedKeys}
        />
      )}
      {tab === 'search' && (
        <SearchTab
          userSet={userSet}
          onOpenDetail={handleOpenDetail}
          addMissing={addMissing}
          addedKeys={addedKeys}
        />
      )}
      {tab === 'saved' && (
        <SavedTab
          userSet={userSet}
          onOpenSaved={handleOpenSaved}
          addMissing={addMissing}
          addedKeys={addedKeys}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
