import { apiClient } from './client'
import type { SearchResults } from '@/types/search'

const EMPTY: SearchResults = { items: [], decks: [], collections: [], spaces: [], views: [] }

export async function searchLibrary(query: string): Promise<SearchResults> {
  const q = query.trim()
  if (!q) return EMPTY
  const res = await apiClient.get<SearchResults>('/api/v1/search', { params: { q } })
  return res.data
}
