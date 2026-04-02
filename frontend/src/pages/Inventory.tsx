import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInventory, deleteItem, updateItem } from '../api/inventory'
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

// ── Quick-update modal ──────────────────────────────────────────────────────

function QuickUpdateModal({
  item,
  siblings,
  onClose,
  onUpdate,
}: {
  item: InventoryItem
  siblings: InventoryItem[]  // other active packages with the same name
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
        {/* Header */}
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
            {/* Level bar + selector */}
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

            {/* Staple toggle */}
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

// ── Package card (used inside multi-package groups) ─────────────────────────

function PackageCard({
  item,
  isActive,
  onDelete,
  isDeleting,
  onTap,
}: {
  item: InventoryItem
  isActive: boolean
  onDelete: (id: string) => void
  isDeleting: boolean
  onTap: () => void
}) {
  const level = item.consumptionLevel ?? 1
  const daysUntilExpiry = item.expiryDate
    ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const expiryColor =
    daysUntilExpiry === null      ? 'text-gray-400'
    : daysUntilExpiry <= 0        ? 'text-red-600 font-semibold'
    : daysUntilExpiry <= 3        ? 'text-orange-500 font-semibold'
    :                               'text-gray-500'

  return (
    <li
      onClick={onTap}
      className="relative overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer active:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={[
            'text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0',
            isActive ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500',
          ].join(' ')}>
            {isActive ? 'Active' : 'Unopened'}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>Qty: {item.quantity}</span>
            {item.expiryDate && (
              <span className={expiryColor}>
                Exp: {item.expiryDate}
                {daysUntilExpiry !== null && daysUntilExpiry <= 3 && daysUntilExpiry >= 0
                  ? ` (${daysUntilExpiry}d)` : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
          disabled={isDeleting}
          className="shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
          aria-label="Delete package"
        >
          🗑
        </button>
      </div>
      <div className="h-1 w-full bg-gray-100">
        <div
          className={`h-full transition-all duration-300 ${levelColor(level)}`}
          style={{ width: `${level * 100}%` }}
        />
      </div>
    </li>
  )
}

// ── Single-item card (for name groups with only one package) ────────────────

function ItemCard({
  item,
  onDelete,
  isDeleting,
  onTap,
}: {
  item: InventoryItem
  onDelete: (id: string) => void
  isDeleting: boolean
  onTap: () => void
}) {
  const level = item.consumptionLevel ?? 1
  const daysUntilExpiry = item.expiryDate
    ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const expiryColor =
    daysUntilExpiry === null      ? 'text-gray-400'
    : daysUntilExpiry <= 0        ? 'text-red-600 font-semibold'
    : daysUntilExpiry <= 3        ? 'text-orange-500 font-semibold'
    :                               'text-gray-500'

  return (
    <li
      onClick={onTap}
      className="relative overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer active:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {item.isStaple && <span className="text-amber-400 leading-none">⭐</span>}
            <p className="font-medium text-gray-900 truncate">
              {item.name ?? `Product ${item.barcode}`}
            </p>
          </div>
          {item.brand && <p className="text-xs text-gray-400 mt-0.5">{item.brand}</p>}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
            {item.expiryDate && (
              <span className={`text-xs ${expiryColor}`}>
                Exp: {item.expiryDate}
                {daysUntilExpiry !== null && daysUntilExpiry <= 3 && daysUntilExpiry >= 0
                  ? ` (${daysUntilExpiry}d)` : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
          disabled={isDeleting}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-red-400 active:text-red-600 transition-colors disabled:opacity-40"
          aria-label={`Delete ${item.name ?? `Product ${item.barcode}`}`}
        >
          🗑
        </button>
      </div>
      <div className="h-1 w-full bg-gray-100">
        <div
          className={`h-full transition-all duration-300 ${levelColor(level)}`}
          style={{ width: `${level * 100}%` }}
        />
      </div>
    </li>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Inventory() {
  const [search, setSearch] = useState('')
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null)
  const queryClient = useQueryClient()

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
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

  // Items with consumptionLevel === 0 are hidden (finished packages)
  const active = items.filter((item) => (item.consumptionLevel ?? 1) !== 0)

  const filtered = active.filter((item) => {
    const q = search.toLowerCase()
    return (
      (item.name?.toLowerCase() ?? '').includes(q) ||
      (item.brand ?? '').toLowerCase().includes(q) ||
      (item.barcode ?? '').includes(q)
    )
  })

  const groupedByLocation = LOCATIONS.map((loc) => ({
    location: loc,
    nameGroups: groupByName(filtered.filter((i) => i.location?.toLowerCase() === loc)),
  })).filter(({ nameGroups }) => nameGroups.length > 0)

  // Siblings = other active packages with same name (for modal context)
  const siblings = activeItem
    ? active.filter(
        (i) => i.id !== activeItem.id &&
        (i.name?.toLowerCase().trim() ?? '') === (activeItem.name?.toLowerCase().trim() ?? ''),
      )
    : []

  return (
    <div className="space-y-5 py-4 pb-24">
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

      {isLoading && <p className="text-center text-gray-400 py-12">Loading inventory…</p>}
      {isError && <p className="text-center text-red-500 py-12">Failed to load inventory.</p>}
      {!isLoading && !isError && filtered.length === 0 && (
        <p className="text-center text-gray-400 py-12">
          {search ? 'No items match your search.' : 'Your pantry is empty — start scanning!'}
        </p>
      )}

      {groupedByLocation.map(({ location, nameGroups }) => (
        <section key={location}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {locationLabel[location]} · {nameGroups.reduce((n, g) => n + g.items.length, 0)}
          </h2>
          <div className="space-y-3">
            {nameGroups.map((group) =>
              group.items.length === 1 ? (
                // Single package — plain card with product name
                <ul key={group.key}>
                  <ItemCard
                    item={group.items[0]}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    isDeleting={deleteMutation.isPending && deleteMutation.variables === group.items[0].id}
                    onTap={() => setActiveItem(group.items[0])}
                  />
                </ul>
              ) : (
                // Multiple packages — group header + compact package cards
                <div key={group.key} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-1">
                    {group.isAnyStaple && <span className="text-amber-400 text-sm leading-none">⭐</span>}
                    <p className="text-sm font-semibold text-gray-800 truncate">{group.displayName}</p>
                    <span className="text-xs text-gray-400 shrink-0">· {group.items.length} packages</span>
                  </div>
                  <ul className="space-y-1 pl-3 border-l-2 border-gray-100">
                    {group.items.map((item, idx) => (
                      <PackageCard
                        key={item.id}
                        item={item}
                        isActive={idx === 0}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        isDeleting={deleteMutation.isPending && deleteMutation.variables === item.id}
                        onTap={() => setActiveItem(item)}
                      />
                    ))}
                  </ul>
                </div>
              )
            )}
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
