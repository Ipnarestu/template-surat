const API_BASE = 'http://localhost:3001/api'

export async function billingRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (response.status === 204) return undefined as T
  const result = await response.json().catch(() => null) as { error?: string } | T | null
  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Permintaan tidak berhasil. Periksa koneksi backend lalu coba kembali.'
    throw new Error(message)
  }
  return result as T
}

export const formatIdr = (amount: string | number | null | undefined) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 2,
}).format(Number(amount || 0))

export const dateInputValue = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : ''

export const formatIdDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'
