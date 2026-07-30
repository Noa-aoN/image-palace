import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getItems, getItemNavigationIds } from '@/lib/api/items'
import { apiClient } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(apiClient.get)

describe('items api', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('getItems はページをまたいで全件取得する', async () => {
    mockedGet.mockImplementation(async (_url, config) => {
      // axios 1.19 で params の型が unknown 相当に厳格化されたため、テスト側で形を明示する
      const params = config?.params as { page?: number } | undefined
      const page = Number(params?.page ?? 1)
      const items = page === 1
        ? Array.from({ length: 100 }, (_, i) => ({ id: `a${i}` }))
        : Array.from({ length: 20 }, (_, i) => ({ id: `b${i}` }))
      return { data: { items, meta: { page, per: 100, total_count: 120, total_pages: 2 } } } as never
    })

    const items = await getItems()

    expect(items).toHaveLength(120)
    expect(items[0].id).toBe('a0')
    expect(items[119].id).toBe('b19')
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it('getItemNavigationIds は軽量ナビゲーション API を呼ぶ', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ids: ['i1', 'i2'] } } as never)

    await expect(getItemNavigationIds()).resolves.toEqual(['i1', 'i2'])
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/items/navigation', { params: {} })
  })
})
