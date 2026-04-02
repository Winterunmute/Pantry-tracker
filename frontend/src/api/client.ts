import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach stored access token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, attempt a silent token refresh once
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
            refreshToken,
          })
          localStorage.setItem('accessToken', data.accessToken)
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken)
          }
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
          return apiClient(originalRequest)
        } catch {
          // Refresh failed — clear tokens and let the caller handle the error
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
