import { useQuery } from '@tanstack/react-query'
import { getShoppingList } from '../api/inventory'

function levelColor(level: number) {
  if (level <= 0.25) return 'bg-red-400'
  if (level <= 0.5)  return 'bg-yellow-400'
  return 'bg-green-400'
}

export default function ShoppingList() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: getShoppingList,
  })

  return (
    <div className="space-y-5 py-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shopping List</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scan items to automatically clear them from this list.
        </p>
      </div>

      {isLoading && (
        <p className="text-center text-gray-400 py-12">Loading…</p>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm font-medium">Nothing to buy</p>
          <p className="text-xs mt-1 max-w-xs">
            Mark items as staples on the Inventory page — they'll appear here when running low.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const level = item.consumptionLevel ?? 0
          const pct = Math.round(level * 100)
          return (
            <li
              key={item.id}
              className="relative overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm"
            >
              <div className="px-4 py-3">
                <p className="font-medium text-gray-900 truncate">
                  {item.name ?? `Product ${item.barcode}`}
                </p>
                {item.brand && (
                  <p className="text-xs text-gray-400">{item.brand}</p>
                )}
                <p className="text-xs text-red-500 font-medium mt-0.5">{pct}% remaining</p>
              </div>
              <div className="h-1 w-full bg-gray-100">
                <div
                  className={`h-full transition-all duration-300 ${levelColor(level)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
