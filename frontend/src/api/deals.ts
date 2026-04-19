import apiClient from './client'

export interface DealInfo {
  heading: string
  price: number
  currency: string
  storeName: string
  imageUrl: string | null
  runTill: string | null
  nearbyStoreLabel: string | null
}

export interface DealResponse {
  hasDeal: boolean
  deals: DealInfo[]
}

export async function getDeal(
  query: string,
  lat?: number,
  lng?: number,
): Promise<DealResponse> {
  const params: Record<string, string | number> = { query }
  if (lat !== undefined && lng !== undefined) {
    params.lat = lat
    params.lng = lng
  }
  console.log('[getDeal] sending params:', params)
  const { data } = await apiClient.get<DealResponse>('/api/deals', { params })
  return data
}
