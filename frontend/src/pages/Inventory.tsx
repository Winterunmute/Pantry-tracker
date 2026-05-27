import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInventory, updateItem } from '../api/inventory'
import type { InventoryItem, Location } from '../types'

const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry', 'sundries']

const locationLabel: Record<Location, string> = {
  fridge:   '🧊 Fridge',
  freezer:  '❄️ Freezer',
  pantry:   '🥫 Pantry',
  sundries: '🧴 Sundries',
}

const LEVELS = [
  { value: 0,    label: 'Empty' },
  { value: 0.25, label: '25%'   },
  { value: 0.5,  label: '50%'   },
  { value: 0.75, label: '75%'   },
  { value: 1,    label: 'Full'  },
]

function levelColor(level: number) {
  if (level <= 0.25) return 'bg-red-400'
  if (level <= 0.5)  return 'bg-yellow-400'
  return 'bg-green-400'
}

type NameGroup = {
  key: string
  displayName: string
  brand: string | null
  isAnyStaple: boolean
  items: InventoryItem[]  // sorted: lowest consumptionLevel first (active package first)
}

function groupByName(items: InventoryItem[]): NameGroup[] {
  const map = new Map<string, InventoryItem[]>()
  for (const item of items) {
    const key = item.name?.toLowerCase().trim() ?? `__id__${item.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    displayName: groupItems[0].name ?? `Product ${groupItems[0].barcode}`,
    brand: groupItems[0].brand ?? null,
    isAnyStaple: groupItems.some((i) => i.isStaple),
    items: [...groupItems].sort((a, b) => (a.consumptionLevel ?? 1) - (b.consumptionLevel ?? 1)),
  }))
}

// ── Quick-update modal ───────────────────────────────────────────────────────

function QuickUpdateModal({
  item,
  siblings,
  onClose,
  onUpdate,
}: {
  item: InventoryItem
  siblings: InventoryItem[]
  onClose: () => void
  onUpdate: (patch: Partial<InventoryItem>) => void
}) {
  const level = item.consumptionLevel ?? 1
  const [flashMsg, setFlashMsg] = useState<string | null>(null)

  function handleLevelSelect(value: number) {
    onUpdate({ consumptionLevel: value })
    if (value === 0) {
      const hasNextPackage = siblings.some((s) => (s.consumptionLevel ?? 1) > 0)
      if (hasNextPackage) {
        setFlashMsg('📦 Package finished — next one is now active')
      } else if (item.isStaple) {
        setFlashMsg('🛒 Added to shopping list')
      }
      setTimeout(onClose, 1300)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 leading-snug">
              {item.name ?? `Product ${item.barcode}`}
            </p>
            {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg"
          >
            ✕
          </button>
        </div>

        {flashMsg ? (
          <div className="py-4 text-center text-green-600 font-semibold text-sm">{flashMsg}</div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Level</p>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${levelColor(level)}`}
                  style={{ width: `${level * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-5 gap-1">
                {LEVELS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => handleLevelSelect(l.value)}
                    className={[
                      'rounded-lg py-2 text-xs font-medium transition-colors min-h-[40px]',
                      level === l.value
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onUpdate({ isStaple: !item.isStaple })}
              className={[
                'w-full rounded-xl py-3 text-sm font-semibold transition-colors min-h-[48px]',
                item.isStaple
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {item.isStaple ? '⭐ Staple (tap to remove)' : '☆ Mark as Staple'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Item tile ────────────────────────────────────────────────────────────────

function ItemTile({ group, onTap }: { group: NameGroup; onTap: () => void }) {
  const level = group.items[0].consumptionLevel ?? 1
  const count = group.items.reduce((sum, i) => sum + (i.quantity ?? 1), 0)

  return (
    <button
      onClick={onTap}
      className="relative w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.97] transition-transform focus:outline-none focus:ring-2 focus:ring-brand-400"
    >
      <div className="p-3 pb-2">
        {/* Top badge row — only rendered when there's content */}
        {(count > 1 || group.isAnyStaple) && (
          <div className="flex items-center justify-between mb-1.5">
            {count > 1 ? (
              <span className="text-xs font-semibold bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 leading-none">
                ×{count}
              </span>
            ) : (
              <span />
            )}
            {group.isAnyStaple && (
              <span className="text-xs text-amber-400 leading-none">⭐</span>
            )}
          </div>
        )}

        {/* Product name — 2 line max */}
        <p className="font-medium text-sm text-gray-900 line-clamp-2 leading-tight">
          {group.displayName}
        </p>

        {/* Brand */}
        {group.brand && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{group.brand}</p>
        )}
      </div>

      {/* Consumption bar — flush to bottom */}
      <div className="h-1.5 w-full bg-gray-100">
        <div
          className={`h-full transition-all duration-300 ${levelColor(level)}`}
          style={{ width: `${Math.max(level * 100, 3)}%` }}
        />
      </div>
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type TabId = 'all' | Location

export default function Inventory() {
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null)
  const queryClient = useQueryClient()

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InventoryItem> }) =>
      updateItem(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  })

  function handleUpdate(patch: Partial<InventoryItem>) {
    if (!activeItem) return
    const updated = { ...activeItem, ...patch }
    setActiveItem(updated)
    updateMutation.mutate({ id: activeItem.id, patch: updated })
  }

  // consumptionLevel === 0 items are consumed — always hidden
  const active = items.filter((i) => (i.consumptionLevel ?? 1) !== 0)

  const filtered = active.filter((item) => {
    const q = search.toLowerCase()
    return (
      (item.name?.toLowerCase() ?? '').includes(q) ||
      (item.brand ?? '').toLowerCase().includes(q) ||
      (item.barcode ?? '').includes(q)
    )
  })

  // Name groups per location
  const groupsByLocation = Object.fromEntries(
    LOCATIONS.map((loc) => [
      loc,
      groupByName(filtered.filter((i) => i.location?.toLowerCase() === loc)),
    ]),
  ) as Record<Location, NameGroup[]>

  const totalGroups = LOCATIONS.reduce((n, loc) => n + groupsByLocation[loc].length, 0)

  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: 'all',      label: 'Alla',        count: totalGroups },
    { id: 'fridge',   label: '🧊 Fridge',   count: groupsByLocation.fridge.length },
    { id: 'freezer',  label: '❄️ Freezer',  count: groupsByLocation.freezer.length },
    { id: 'pantry',   label: '🥫 Pantry',   count: groupsByLocation.pantry.length },
    { id: 'sundries', label: '🧴 Sundries', count: groupsByLocation.sundries.length },
  ]

  // Sections to render in the grid
  const sections =
    activeTab === 'all'
      ? LOCATIONS
          .filter((loc) => groupsByLocation[loc].length > 0)
          .map((loc) => ({ location: loc, groups: groupsByLocation[loc] }))
      : groupsByLocation[activeTab as Location].length > 0
        ? [{ location: activeTab as Location, groups: groupsByLocation[activeTab as Location] }]
        : []

  const siblings = activeItem
    ? active.filter(
        (i) =>
          i.id !== activeItem.id &&
          (i.name?.toLowerCase().trim() ?? '') === (activeItem.name?.toLowerCase().trim() ?? ''),
      )
    : []

  return (
    <div className="space-y-4 py-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          type="search"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[48px]"
        />
      </div>

      {/* Location tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-4 px-4 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex-none flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            ].join(' ')}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={[
                  'text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold',
                  activeTab === tab.id
                    ? 'bg-white/25 text-white'
                    : 'bg-gray-100 text-gray-500',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* States */}
      {isLoading && <p className="text-center text-gray-400 py-12">Loading inventory…</p>}
      {isError   && <p className="text-center text-red-500  py-12">Failed to load inventory.</p>}

      {!isLoading && !isError && sections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm font-medium">
            {search ? 'No items match your search.' : 'Nothing here — start scanning!'}
          </p>
        </div>
      )}

      {/* Grid sections */}
      {sections.map(({ location, groups }) => (
        <section key={location} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {locationLabel[location]}
            <span className="ml-1.5 font-normal normal-case tracking-normal text-gray-300">
              · {groups.length}
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {groups.map((group) => (
              <ItemTile
                key={group.key}
                group={group}
                onTap={() => setActiveItem(group.items[0])}
              />
            ))}
          </div>
        </section>
      ))}

      {activeItem && (
        <QuickUpdateModal
          item={activeItem}
          siblings={siblings}
          onClose={() => setActiveItem(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
