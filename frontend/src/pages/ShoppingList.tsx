import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { getShoppingList } from '../api/inventory'
import { getDeal } from '../api/deals'
import type { DealResponse, DealInfo } from '../api/deals'
import type { InventoryItem } from '../types'

const NO_DEALS: DealResponse = { hasDeal: false, deals: [] }

type GeoStatus = 'idle' | 'pending' | 'active' | 'denied'
type Tab = 'list' | 'deals'

// ── Helpers ───────────────────────────────────────────────────────────────────

function levelColor(level: number) {
  if (level <= 0.25) return 'bg-red-400'
  if (level <= 0.5)  return 'bg-yellow-400'
  return 'bg-green-400'
}

/** Format price: 25.0 → "25 kr", 19.9 → "19,90 kr" */
function formatPrice(price: number, currency: string) {
  const formatted = Number.isInteger(price)
    ? `${price}`
    : price.toFixed(2).replace('.', ',')
  return `${formatted} ${currency === 'SEK' ? 'kr' : currency}`
}

function shortenStoreName(name: string) {
  return name
    .replace('ICA Maxi Stormarknad', 'ICA Maxi')
    .replace('Willys Hemma', 'Willys H.')
    .replace('Stora Coop', 'St. Coop')
    .replace('Coop X:-TRA', 'Coop X')
}

/**
 * Strips the chain name prefix from a catalog label to get just the location part.
 * "ICA Kvantum Hötorget" with storeName "ICA Kvantum" → "Hötorget"
 * "Coop Hötorget" with storeName "Coop" → "Hötorget"
 * Returns the full label if no match or if stripping leaves nothing.
 */
function locationSuffix(storeName: string, nearbyLabel: string): string {
  const prefix = storeName.toLowerCase()
  if (nearbyLabel.toLowerCase().startsWith(prefix)) {
    const rest = nearbyLabel.slice(storeName.length).trim()
    return rest || nearbyLabel
  }
  return nearbyLabel
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LevelBar({ level }: { level: number }) {
  return (
    <div className="h-1 w-full bg-gray-100">
      <div
        className={`h-full transition-all duration-300 ${levelColor(level)}`}
        style={{ width: `${Math.round(level * 100)}%` }}
      />
    </div>
  )
}

function DealBadge({ deal }: { deal: DealInfo }) {
  console.log('[DealBadge]', deal.storeName, '· nearbyStoreLabel:', deal.nearbyStoreLabel)

  const location = deal.nearbyStoreLabel
    ? locationSuffix(deal.storeName, deal.nearbyStoreLabel)
    : 'Ej i närheten'

  return (
    <span
      className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-800 text-xs font-medium px-2 py-1 rounded-lg"
      title={deal.heading}
    >
      🏷️ {shortenStoreName(deal.storeName)}
      {' · '}
      <span className="font-bold">{formatPrice(deal.price, deal.currency)}</span>
      <span className={`font-normal ${deal.nearbyStoreLabel ? 'text-orange-500' : 'text-gray-400'}`}>
        {' · 📍 '}{location}
      </span>
    </span>
  )
}

// ── Inköpslista tab ───────────────────────────────────────────────────────────

function ShoppingTab({
  items,
  isLoading,
  dealQueries,
}: {
  items: InventoryItem[]
  isLoading: boolean
  dealQueries: { data?: DealResponse; isLoading: boolean }[]
}) {
  if (isLoading) return <p className="text-center text-gray-400 py-12">Loading…</p>

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <p className="text-4xl mb-3">✅</p>
        <p className="text-sm font-medium">Nothing to buy</p>
        <p className="text-xs mt-1 max-w-xs">
          Mark items as staples on the Inventory page — they'll appear here when running low.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((item, idx) => {
        const level    = item.consumptionLevel ?? 0
        const pct      = Math.round(level * 100)
        const dq       = dealQueries[idx]
        const dealData = dq?.data

        return (
          <li
            key={item.id}
            className="relative overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm"
          >
            <div className="px-4 py-3 space-y-2">
              <div>
                <p className="font-medium text-gray-900 truncate">
                  {item.name ?? `Product ${item.barcode}`}
                </p>
                {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
                <p className="text-xs text-red-500 font-medium mt-0.5">{pct}% remaining</p>
              </div>
              {dq?.isLoading && item.name && (
                <div className="flex gap-1.5">
                  <span className="h-6 w-28 bg-gray-100 rounded-lg animate-pulse" />
                  <span className="h-6 w-20 bg-gray-100 rounded-lg animate-pulse" />
                </div>
              )}
              {dealData?.hasDeal && dealData.deals.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dealData.deals.slice(0, 4).map((deal, i) => (
                    <DealBadge key={i} deal={deal} />
                  ))}
                  {dealData.deals.length > 4 && (
                    <span className="text-xs text-orange-600 self-center">
                      +{dealData.deals.length - 4} till
                    </span>
                  )}
                </div>
              )}
            </div>
            <LevelBar level={level} />
          </li>
        )
      })}
    </ul>
  )
}

// ── Deals tab ─────────────────────────────────────────────────────────────────

function DealsTab({
  items,
  isLoading,
  dealQueries,
  geoStatus,
  coords,
}: {
  items: InventoryItem[]
  isLoading: boolean
  dealQueries: { data?: DealResponse; isLoading: boolean }[]
  geoStatus: GeoStatus
  coords: { lat: number; lng: number } | null
}) {
  console.log('[DealsTab] render — geoStatus:', geoStatus, '· coords:', coords)
  const firstData = dealQueries.find(dq => dq.data)?.data
  if (firstData) {
    console.log('[DealsTab] sample deals:', firstData.deals.slice(0, 2))
  }

  const anyLoading = isLoading || dealQueries.some(dq => dq.isLoading)

  if (anyLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const withDeals = items
    .map((item, idx) => ({ item, deals: dealQueries[idx]?.data?.deals ?? [] }))
    .filter(({ deals }) => deals.length > 0)
    .sort((a, b) => {
      const minA = Math.min(...a.deals.map(d => d.price))
      const minB = Math.min(...b.deals.map(d => d.price))
      return minA - minB
    })

  if (withDeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <p className="text-4xl mb-3">🏷️</p>
        <p className="text-sm font-medium">Inga deals hittades för dina varor just nu</p>
        <p className="text-xs mt-1 max-w-xs">
          Deals hämtas från reklamblad på eReklamblad.se och uppdateras varje timme.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Location status indicator */}
      {geoStatus === 'pending' && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <span className="animate-pulse">📍</span> Hämtar din plats…
        </p>
      )}
      {geoStatus === 'active' && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          📍 Visar deals nära dig
        </p>
      )}
      {geoStatus === 'denied' && (
        <p className="text-xs text-gray-400">
          Platstillstånd nekades — visar alla deals utan avstånd.
        </p>
      )}

      <ul className="space-y-2">
        {withDeals.map(({ item, deals }) => {
          const level     = item.consumptionLevel ?? 0
          const bestPrice = Math.min(...deals.map(d => d.price))
          const bestDeal  = deals.find(d => d.price === bestPrice)!

          return (
            <li
              key={item.id}
              className="relative overflow-hidden bg-white rounded-xl border border-orange-100 shadow-sm"
            >
              <div className="px-4 py-3 space-y-2">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {item.name ?? `Product ${item.barcode}`}
                    </p>
                    {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
                  </div>
                  {/* Best price callout */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">från</p>
                    <p className="text-lg font-bold text-orange-600 leading-none">
                      {formatPrice(bestPrice, bestDeal.currency)}
                    </p>
                  </div>
                </div>

                {/* All deals */}
                <div className="flex flex-wrap gap-1.5">
                  {deals.map((deal, i) => (
                    <DealBadge key={i} deal={deal} />
                  ))}
                </div>
              </div>
              <LevelBar level={level} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Shopping Mode (full-screen checklist) ─────────────────────────────────────

function ShoppingMode({
  items,
  dealQueries,
  onExit,
}: {
  items: InventoryItem[]
  dealQueries: { data?: DealResponse; isLoading: boolean }[]
  onExit: () => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const total   = items.length
  const done    = checked.size
  const allDone = done === total && total > 0

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Unchecked first, checked last
  const sorted = [...items].sort((a, b) => {
    const aC = checked.has(a.id) ? 1 : 0
    const bC = checked.has(b.id) ? 1 : 0
    return aC - bC
  })

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 pt-safe-top">
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-base font-semibold text-gray-900">
              {done} / {total} klara
            </p>
          </div>
          <button
            onClick={onExit}
            className="text-gray-500 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200"
          >
            ✕ Avsluta
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-gray-100 rounded-full mb-3">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-3 px-4 space-y-2">
        {sorted.map((item, _idx) => {
          const origIdx  = items.findIndex(i => i.id === item.id)
          const dq       = dealQueries[origIdx]
          const bestDeal = dq?.data?.deals?.[0] ?? null
          const isChecked = checked.has(item.id)

          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`w-full text-left flex items-center gap-4 bg-white rounded-2xl px-4 py-4 border shadow-sm active:scale-[0.98] transition-transform ${
                isChecked ? 'border-gray-100 opacity-50' : 'border-gray-200'
              }`}
            >
              {/* Checkbox */}
              <div className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                isChecked
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300'
              }`}>
                {isChecked && <span className="text-sm leading-none">✓</span>}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-semibold leading-tight ${isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.name ?? `Product ${item.barcode}`}
                </p>
                {item.brand && (
                  <p className="text-sm text-gray-400 mt-0.5">{item.brand}</p>
                )}
                {bestDeal && !isChecked && (
                  <span className="inline-flex items-center gap-1 mt-1.5 bg-orange-50 border border-orange-200 text-orange-800 text-xs font-medium px-2 py-0.5 rounded-lg">
                    🏷️ {shortenStoreName(bestDeal.storeName)}
                    {' · '}
                    <span className="font-bold">{formatPrice(bestDeal.price, bestDeal.currency)}</span>
                    {bestDeal.nearbyStoreLabel && (
                      <span className="text-orange-500">
                        {' · 📍 '}{locationSuffix(bestDeal.storeName, bestDeal.nearbyStoreLabel)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Bottom action */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 pb-safe-bottom">
        {allDone ? (
          <button
            onClick={onExit}
            className="w-full py-4 bg-green-500 text-white text-lg font-bold rounded-2xl active:bg-green-600 transition-colors shadow"
          >
            ✅ Klar
          </button>
        ) : (
          <p className="text-center text-sm text-gray-400">
            Kryssa av varor när du lägger dem i korgen
          </p>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const [activeTab, setActiveTab] = useState<Tab>('list')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [shoppingMode, setShoppingMode] = useState(false)
  const geoRequested = useRef(false)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: getShoppingList,
  })

  // Request geolocation once when the Deals tab is first opened
  useEffect(() => {
    if (activeTab !== 'deals' || geoRequested.current) return
    if (!navigator.geolocation) return
    geoRequested.current = true
    setGeoStatus('pending')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoStatus('active')
      },
      () => setGeoStatus('denied'),
      { timeout: 10_000 },
    )
  }, [activeTab])

  // Including coords in the query key re-fires all deal queries once location arrives
  const dealQueries = useQueries({
    queries: items.map(item => ({
      queryKey: ['deal', item.name ?? item.barcode ?? item.id, coords?.lat, coords?.lng],
      queryFn: (): Promise<DealResponse> =>
        item.name
          ? getDeal(item.name, coords?.lat, coords?.lng)
          : Promise.resolve(NO_DEALS),
      staleTime: 60 * 60 * 1000,
      enabled: !isLoading,
    })),
  })

  const dealCount = dealQueries.filter(dq => dq.data?.hasDeal).length

  if (shoppingMode) {
    return (
      <ShoppingMode
        items={items}
        dealQueries={dealQueries}
        onExit={() => setShoppingMode(false)}
      />
    )
  }

  return (
    <div className="space-y-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopping List</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scan items to automatically clear them from this list.
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setShoppingMode(true)}
            className="shrink-0 flex items-center gap-1.5 bg-brand-600 text-white text-sm font-semibold px-3 py-2 rounded-xl shadow-sm active:bg-brand-700 hover:bg-brand-700 transition-colors"
          >
            🛒 Handla-läge
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'list'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Inköpslista
          {items.length > 0 && (
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
              {items.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('deals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'deals'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Deals 🏷️
          {dealCount > 0 && (
            <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5">
              {dealCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'list' ? (
        <ShoppingTab items={items} isLoading={isLoading} dealQueries={dealQueries} />
      ) : (
        <DealsTab
          items={items}
          isLoading={isLoading}
          dealQueries={dealQueries}
          geoStatus={geoStatus}
          coords={coords}
        />
      )}
    </div>
  )
}
