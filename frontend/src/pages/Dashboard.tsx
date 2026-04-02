import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getInventory } from '../api/inventory'
import type { Location } from '../types'

const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry', 'sundries']

const locationMeta: Record<Location, { label: string; icon: string; bg: string; text: string }> = {
  fridge:   { label: 'Fridge',   icon: '🧊', bg: 'bg-blue-50',   text: 'text-blue-700'  },
  freezer:  { label: 'Freezer',  icon: '❄️', bg: 'bg-cyan-50',   text: 'text-cyan-700'  },
  pantry:   { label: 'Pantry',   icon: '🥫', bg: 'bg-amber-50',  text: 'text-amber-700' },
  sundries: { label: 'Sundries', icon: '🧴', bg: 'bg-purple-50', text: 'text-purple-700'},
}

export default function Dashboard() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
  })

  const countByLocation = (loc: Location) =>
    items.filter((i) => i.location?.toLowerCase() === loc).length

  const expiryWarnings = items.filter((i) => {
    if (!i.expiryDate) return false
    const days = Math.ceil(
      (new Date(i.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    return days <= 3 && days >= 0
  })

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

      {/* Expiry warnings */}
      {expiryWarnings.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Expiring Soon
          </h2>
          <ul className="space-y-2">
            {expiryWarnings.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3"
              >
                <span className="font-medium text-red-900 text-sm">{item.name}</span>
                <span className="text-xs text-red-600 font-semibold">
                  {item.expiryDate}
                </span>
              </li>
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
