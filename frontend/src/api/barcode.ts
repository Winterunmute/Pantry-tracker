import apiClient from './client'
import type { BarcodeResponse } from '../types'

export async function lookupBarcode(barcode: string): Promise<BarcodeResponse> {
  const { data } = await apiClient.post<BarcodeResponse>('/api/barcode', { barcode })
  return data
}
