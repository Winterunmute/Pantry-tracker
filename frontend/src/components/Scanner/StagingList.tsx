import type { StagingItem, Location } from '../../types'

const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry', 'sundries']

interface StagingListProps {
  items: StagingItem[]
  onConfirm: () => void
  onChange: (items: StagingItem[]) => void
}

function StagingItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: StagingItem
  onChange: (updated: StagingItem) => void
  onRemove: () => void
}) {
  function update<K extends keyof StagingItem>(key: K, value: StagingItem[K]) {
    onChange({ ...item, [key]: value })
  }

  return (
    <li className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm leading-snug truncate">
            {item.productName}
          </p>
          {item.brand && (
            <p className="text-xs text-gray-400">{item.brand}</p>
          )}
          <p className="text-xs text-gray-300 font-mono mt-0.5">{item.barcode}</p>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-red-400 active:text-red-600 transition-colors"
          aria-label={`Remove ${item.productName}`}
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2">
        {/* Quantity */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Qty</label>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => update('quantity', Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[40px]"
          />
        </div>

        {/* Location */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Location</label>
            {item.locationRemembered && (
              <span className="text-xs text-blue-500 font-medium">📍 Remembered</span>
            )}
          </div>
          <select
            value={item.location}
            onChange={(e) => onChange({ ...item, location: e.target.value as Location, locationRemembered: false })}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[40px]"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc.charAt(0).toUpperCase() + loc.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expiry date */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Expiry date (optional)</label>
        <input
          type="date"
          value={item.expiryDate ?? ''}
          onChange={(e) => update('expiryDate', e.target.value || null)}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[40px]"
        />
      </div>
    </li>
  )
}

export default function StagingList({ items, onConfirm, onChange }: StagingListProps) {
  function updateItem(index: number, updated: StagingItem) {
    const next = [...items]
    next[index] = updated
    onChange(next)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
        <p className="text-4xl mb-2">📋</p>
        <p className="text-sm">Scanned items will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Staging · {items.length} item{items.length !== 1 ? 's' : ''}
        </h2>
      </div>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <StagingItemRow
            key={`${item.barcode}-${index}`}
            item={item}
            onChange={(updated) => updateItem(index, updated)}
            onRemove={() => removeItem(index)}
          />
        ))}
      </ul>

      <button
        onClick={onConfirm}
        className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-semibold rounded-xl py-4 transition-colors min-h-[56px] mt-1"
      >
        Confirm All ({items.length})
      </button>
    </div>
  )
}
