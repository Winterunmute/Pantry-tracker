import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createItem } from '../api/inventory'
import type { Location } from '../types'

const LOCATIONS: Location[] = ['fridge', 'freezer', 'pantry', 'sundries']

interface FormState {
  name: string
  barcode: string
  brand: string
  quantity: string
  location: Location
  expiryDate: string
}

const INITIAL: FormState = {
  name: '',
  barcode: '',
  brand: '',
  quantity: '1',
  location: 'pantry',
  expiryDate: '',
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  )
}

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[48px]'

export default function Add() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory'] })
      navigate('/inventory')
    },
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    mutation.mutate({
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      brand: form.brand.trim() || null,
      quantity: Math.max(1, parseInt(form.quantity) || 1),
      location: form.location,
      expiryDate: form.expiryDate || null,
      imageUrl: null,
    })
  }

  return (
    <div className="py-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Add Item Manually</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name (required) */}
        <div>
          <FieldLabel htmlFor="name">Item name *</FieldLabel>
          <input
            id="name"
            type="text"
            required
            placeholder="e.g. Oat milk"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Brand */}
        <div>
          <FieldLabel htmlFor="brand">Brand</FieldLabel>
          <input
            id="brand"
            type="text"
            placeholder="e.g. Oatly"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Barcode */}
        <div>
          <FieldLabel htmlFor="barcode">Barcode (optional)</FieldLabel>
          <input
            id="barcode"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 012345678901"
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Quantity + Location row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
            <input
              id="quantity"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="location">Location</FieldLabel>
            <select
              id="location"
              value={form.location}
              onChange={(e) => set('location', e.target.value as Location)}
              className={inputClass}
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
          <FieldLabel htmlFor="expiryDate">Expiry date (optional)</FieldLabel>
          <input
            id="expiryDate"
            type="date"
            value={form.expiryDate}
            onChange={(e) => set('expiryDate', e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Error */}
        {mutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
            Failed to add item. Please try again.
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending || !form.name.trim()}
          className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-gray-300 text-white font-semibold rounded-xl py-4 transition-colors min-h-[56px]"
        >
          {mutation.isPending ? 'Adding…' : 'Add to Pantry'}
        </button>
      </form>
    </div>
  )
}
