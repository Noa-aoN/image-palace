import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useFeaturesStore, FEATURES_REFRESH_INTERVAL_MS } from '@/stores/features'

vi.mock('@/lib/api/features', () => ({
  getFeatureStages: vi.fn(async () => ({ features: { atelier: 'released' }, paths: {}, notes: {} })),
}))

// 段階は運営がいつでも変えられるが、**開きっぱなしの画面には届かない**。
// 読み直しの決まりだけを確かめる（画面の組み立てはここでは見ない）。
describe('機能の段階の読み直し', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFeaturesStore.setState({ stages: null, paths: null, notes: null, loading: false, fetchedAt: 0 })
  })

  afterEach(() => vi.useRealTimers())

  it('はじめの1回だけ読む（同じ画面で何度も呼ばれても増やさない）', async () => {
    const { getFeatureStages } = await import('@/lib/api/features')
    useFeaturesStore.getState().load()
    await vi.waitFor(() => expect(useFeaturesStore.getState().stages).not.toBeNull())

    useFeaturesStore.getState().load()

    expect(getFeatureStages).toHaveBeenCalledTimes(1)
  })

  it('読み直しは、すでに読んでいても取りに行く', async () => {
    const { getFeatureStages } = await import('@/lib/api/features')
    useFeaturesStore.getState().load()
    await vi.waitFor(() => expect(useFeaturesStore.getState().stages).not.toBeNull())

    useFeaturesStore.getState().refresh()
    await vi.waitFor(() => expect(getFeatureStages).toHaveBeenCalledTimes(2))
  })

  it('読み終えた時刻を残す（間隔を測るのに要る）', async () => {
    useFeaturesStore.getState().load()

    await vi.waitFor(() => expect(useFeaturesStore.getState().fetchedAt).toBeGreaterThan(0))
  })

  it('取り直しの間隔は、行き来のたびに問い合わせない程度にある', () => {
    expect(FEATURES_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(30_000)
  })
})
