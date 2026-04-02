import apiClient from './client'
import type { CreateItemPayload, InventoryItem, UpdateItemPayload } from '../types'

export async function getInventory(): Promise<InventoryItem[]> {
  const { data } = await apiClient.get<InventoryItem[]>('/api/inventory')
  console.debug('[inventory] GET /api/inventory →', data.map(i => ({ id: i.id, name: i.name, isStaple: i.isStaple, consumptionLevel: i.consumptionLevel })))
  return data
}

export async function getShoppingList(): Promise<InventoryItem[]> {
  const { data } = await apiClient.get<InventoryItem[]>('/api/inventory/shopping-list')
  return data
}

export async function createItem(item: CreateItemPayload): Promise<InventoryItem> {
  const { data } = await apiClient.post<InventoryItem>('/api/inventory', item)
  return data
}

export async function updateItem(id: string, item: UpdateItemPayload): Promise<InventoryItem> {
  const { data } = await apiClient.put<InventoryItem>(`/api/inventory/${id}`, item)
  return data
}

export async function deleteItem(id: string): Promise<void> {
  await apiClient.delete(`/api/inventory/${id}`)
}
