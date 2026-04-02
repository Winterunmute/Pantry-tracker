import apiClient from './client'
import type { AuthRequest, AuthResponse } from '../types'

export async function login(req: AuthRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/auth/login', req)
  return data
}

export async function register(req: AuthRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/auth/register', req)
  return data
}

export async function refresh(token: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/auth/refresh', {
    refreshToken: token,
  })
  return data
}
