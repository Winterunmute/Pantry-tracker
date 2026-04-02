import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import BarcodeScanner from '../components/Scanner/BarcodeScanner'
import StagingList from '../components/Scanner/StagingList'
import { lookupBarcode } from '../api/barcode'
import { createItem, getShoppingList, updateItem } from '../api/inventory'
import { lookupLocation, rememberLocation } from '../utils/locationMemory'
import { namesMatch } from '../utils/nameMatch'
import type { InventoryItem, StagingItem, Location } from '../types'

type Status = 'idle' | 'confirming' | 'done' | 'error'

const DEV_BARCODES = [
  // Original 4
  { label: 'Arla Mellanmjölk',   barcode: '7310500144511', brand: 'Arla'         },
  { label: "McVitie's Digestive", barcode: '7622210449283', brand: "McVitie's"    },
  { label: 'Häagen-Dazs Glass',   barcode: '5000174155747', brand: 'Häagen-Dazs'  },
  { label: 'Lambi Toapapper',     barcode: '7310610011065', brand: 'Lambi'         },
  // 4 new — includes two same-type items to test natural name matching
  { label: 'Garant Lättmjölk',   barcode: '7340011405642', brand: 'COOP'          }, // "mjölk" matches Arla Mellanmjölk
  { label: 'GB Vaniljglass',      barcode: '7310060007898', brand: 'GB'            }, // "glass" matches Häagen-Dazs Glass
  { label: 'Activia Naturell',    barcode: '3033490004316', brand: 'Activia'       }, // yoghurt, fridge
  { label: 'Barilla Spaghetti',   barcode: '8076808002432', brand: 'Barilla'       }, // pasta, pantry
  { label: 'De Cecco Spaghetti',  barcode: '8001250210609', brand: 'De Cecco'      },
]

export default function Scan() {
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [lookingUp, setLookingUp] = useState<string | null>(null)
  const [shoppingToasts, setShoppingToasts] = useState<string[]>([])
  const queryClient = useQueryClient()

  function buildStagingItem(
    barcode: string,
    productName: string | null,
    brand: string | null,
    imageUrl: string | null,
  ): StagingItem {
    const remembered = lookupLocation(productName)
    return {
      barcode,
      productName: productName ?? `Product ${barcode}`,
      brand: brand ?? '',
      imageUrl,
      quantity: 1,
      location: (remembered ?? 'pantry') as Location,
      expiryDate: null,
      locationRemembered: remembered !== null,
    }
  }

  function addToStaging(barcode: string, productName: string, brand: string, imageUrl: string | null) {
    setStagingItems((prev) => [...prev, buildStagingItem(barcode, productName, brand, imageUrl)])
  }

  const handleDetected = useCallback(async (barcode: string) => {
    setLookingUp(barcode)
    try {
      const result = await lookupBarcode(barcode)
      setStagingItems((prev) => [
        ...prev,
        buildStagingItem(barcode, result.productName, result.brand, result.imageUrl),
      ])
    } catch {
      setStagingItems((prev) => [...prev, buildStagingItem(barcode, null, null, null)])
    } finally {
      setLookingUp(null)
    }
  }, [])

  async function handleConfirm() {
    if (stagingItems.length === 0) return
    setStatus('confirming')
    try {
      // Inherit isStaple from existing inventory items with the same name
      const existingInventory = queryClient.getQueryData<InventoryItem[]>(['inventory']) ?? []

      await Promise.all(
        stagingItems.map((staged) => {
          const sameNameInInventory = existingInventory.filter(
            (i) => i.name && namesMatch(i.name, staged.productName),
          )
          const inheritStaple = sameNameInInventory.some((i) => i.isStaple)
          return createItem({
            name: staged.productName,
            barcode: staged.barcode,
            brand: staged.brand,
            quantity: staged.quantity,
            location: staged.location,
            expiryDate: staged.expiryDate,
            imageUrl: staged.imageUrl,
            isStaple: inheritStaple,
          })
        }),
      )

      stagingItems.forEach((item) => rememberLocation(item.productName, item.location))
      await queryClient.invalidateQueries({ queryKey: ['inventory'] })

      // Clear matching shopping list items by de-stapling the old item.
      // consumptionLevel stays at 0 (item remains hidden from inventory).
      // The new scanned item already inherits isStaple=true from the inventory cache.
      const shoppingList = await getShoppingList()
      const alreadyMatched = new Set<string>()
      const removedNames: string[] = []

      for (const staged of stagingItems) {
        for (const shopItem of shoppingList) {
          if (alreadyMatched.has(shopItem.id)) continue
          if (namesMatch(staged.productName, shopItem.name ?? '')) {
            alreadyMatched.add(shopItem.id)
            removedNames.push(shopItem.name ?? staged.productName)
            // Mark old item as non-staple so it exits the shopping list — don't restore its level
            updateItem(shopItem.id, { ...shopItem, isStaple: false })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
                queryClient.invalidateQueries({ queryKey: ['inventory'] })
              })
              .catch(() => {})
            break
          }
        }
      }

      setStagingItems([])
      setStatus('done')
      setTimeout(() => setStatus('idle'), 2500)

      if (removedNames.length > 0) {
        setShoppingToasts(removedNames)
        setTimeout(() => setShoppingToasts([]), 3500)
      }
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Scan Items</h1>

      {/* Status toasts */}
      {lookingUp && (
        <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="animate-spin inline-block">⏳</span>
          Looking up {lookingUp}…
        </div>
      )}
      {status === 'done' && (
        <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3">
          ✅ Items added to inventory!
        </div>
      )}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
          ❌ Failed to save some items. Please try again.
        </div>
      )}
      {shoppingToasts.map((name, i) => (
        <div
          key={i}
          className="bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-xl px-4 py-3"
        >
          🛒 Removed <span className="font-semibold">{name}</span> from shopping list
        </div>
      ))}

      {/* Scanner */}
      <BarcodeScanner onDetected={handleDetected} />

      {/* Dev-only barcode simulator */}
      {import.meta.env.DEV && (
        <div className="rounded-xl border-2 border-dashed border-yellow-400 bg-yellow-50 p-3">
          <p className="text-xs font-bold text-yellow-700 uppercase tracking-widest mb-2">
            ⚠ Dev only — barcode simulator
          </p>
          <div className="flex flex-wrap gap-2">
            {DEV_BARCODES.map(({ label, barcode, brand }) => (
              <button
                key={barcode}
                onClick={() => addToStaging(barcode, label, brand, null)}
                className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-yellow-900 hover:bg-yellow-500 active:scale-95 transition-transform"
              >
                {label}
                <span className="ml-1 font-mono font-normal opacity-60">{barcode}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Staging list */}
      <StagingList
        items={stagingItems}
        onChange={setStagingItems}
        onConfirm={handleConfirm}
      />

      {status === 'confirming' && (
        <div className="text-center text-sm text-gray-400 py-2">Saving items…</div>
      )}
    </div>
  )
}
