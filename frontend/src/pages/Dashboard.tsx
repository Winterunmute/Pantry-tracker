import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getInventory, getExpiringItems } from '../api/inventory'
import type { InventoryItem, Location } from '../types'

const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry', 'sundries']

const locationMeta: Record<Location, { label: string; icon: string; bg: string; text: string }> = {
  fridge:   { label: 'Fridge',   icon: '🧊', bg: 'bg-blue-50',   text: 'text-blue-700'  },
  freezer:  { label: 'Freezer',  icon: '❄️', bg: 'bg-cyan-50',   text: 'text-cyan-700'  },
  pantry:   { label: 'Pantry',   icon: '🥫', bg: 'bg-amber-50',  text: 'text-amber-700' },
  sundries: { label: 'Sundries', icon: '🧴', bg: 'bg-purple-50', text: 'text-purple-700'},
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function expiryStyle(days: number): { bg: string; border: string; nameText: string; daysText: string } {
  if (days <= 1) return { bg: 'bg-red-50',    border: 'border-red-100',    nameText: 'text-red-900',    daysText: 'text-red-600'    }
  if (days <= 3) return { bg: 'bg-orange-50', border: 'border-orange-100', nameText: 'text-orange-900', daysText: 'text-orange-600' }
  return             { bg: 'bg-yellow-50',  border: 'border-yellow-100', nameText: 'text-yellow-900', daysText: 'text-yellow-600' }
}

function levelColor(level: number) {
  if (level <= 0.25) return 'bg-red-400'
  if (level <= 0.5)  return 'bg-yellow-400'
  return 'bg-green-400'
}

function ExpiringCard({ item }: { item: InventoryItem }) {
  const days = daysUntil(item.expiryDate!)
  const style = expiryStyle(days)
  const level = item.consumptionLevel ?? 1
  const daysLabel = days <= 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days`

  return (
    <li className={`overflow-hidden rounded-xl border ${style.bg} ${style.border}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm truncate ${style.nameText}`}>
            {item.name ?? `Product ${item.barcode}`}
          </p>
          {item.brand && (
            <p className="text-xs text-gray-400 mt-0.5">{item.brand}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold ${style.daysText}`}>{daysLabel}</p>
          <p className="text-xs text-gray-400">{item.expiryDate}</p>
        </div>
      </div>
      <div className="h-1 w-full bg-black/5">
        <div
          className={`h-full transition-all duration-300 ${levelColor(level)}`}
          style={{ width: `${level * 100}%` }}
        />
      </div>
    </li>
  )
}

export default function Dashboard() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
  })

  const { data: expiring = [] } = useQuery({
    queryKey: ['expiring'],
    queryFn: getExpiringItems,
    staleTime: 60_000,
  })

  const countByLocation = (loc: Location) =>
    items.filter((i) => i.location?.toLowerCase() === loc).length

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pantry Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isLoading ? 'Loading…' : `${items.length} item${items.length !== 1 ? 's' : ''} tracked`}
        </p>
      </div>

      {/* Location summary cards */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
          By Location
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {LOCATIONS.map((loc) => {
            const meta = locationMeta[loc]
            return (
              <Link
                key={loc}
                to={`/inventory?location=${loc}`}
                className={`flex items-center gap-3 rounded-xl p-4 ${meta.bg} min-h-[72px] active:opacity-80 transition-opacity`}
              >
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <div className={`text-2xl font-bold leading-none ${meta.text}`}>
                    {isLoading ? '—' : countByLocation(loc)}
                  </div>
                  <div className={`text-xs font-medium mt-0.5 ${meta.text} opacity-80`}>
                    {meta.label}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Expiring soon */}
      {expiring.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Expiring Soon
          </h2>
          <ul className="space-y-2">
            {expiring.map((item) => (
              <ExpiringCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}

      {/* Primary CTA */}
      <Link
        to="/scan"
        className="flex items-center justify-center gap-3 w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-lg font-semibold rounded-2xl py-5 transition-colors min-h-[72px]"
      >
        <span className="text-2xl">📷</span>
        Start Scanning
      </Link>

      <Link
        to="/inventory"
        className="flex items-center justify-center gap-2 w-full border border-gray-300 text-gray-700 font-medium rounded-2xl py-4 hover:bg-gray-100 active:bg-gray-200 transition-colors min-h-[56px]"
      >
        View All Inventory
      </Link>
    </div>
  )
}
