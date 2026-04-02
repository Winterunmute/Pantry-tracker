export type Location = 'fridge' | 'freezer' | 'pantry' | 'sundries'

export interface InventoryItem {
  id: string
  name: string
  barcode: string | null
  brand: string | null
  quantity: number
  location: Location
  expiryDate: string | null
  imageUrl: string | null
  createdAt: string
  consumptionLevel: number   // 0.0–1.0, default 1.0
  isStaple: boolean          // default false
  restockThreshold: number   // default 0.25
}

export interface BarcodeResponse {
  productName: string
  brand: string
  imageUrl: string | null
}

export interface AuthRequest {
  username: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
}

export interface StagingItem extends BarcodeResponse {
  barcode: string
  quantity: number
  location: Location
  expiryDate: string | null
  locationRemembered?: boolean
}

export type CreateItemPayload = Omit<InventoryItem, 'id' | 'createdAt'>

export type UpdateItemPayload = Partial<Omit<InventoryItem, 'id' | 'createdAt'>>
