import { describe, expect, it, beforeEach, vi } from 'vitest'
import { persist } from '@/lib/api/persist'
import { useSaveStatusStore } from '@/stores/saveStatus'

// キャンバスの編集は画面を先に動かしてサーバーへ後から書く。
// 書き込みが落ちても見た目が変わらないので、**言わなければ気づけない**。
// 実際 24 箇所が黙って捨てていて、リロードすると編集が消えていた。
describe('保存の見張り', () => {
  beforeEach(() => {
    useSaveStatusStore.setState({ pending: 0, failed: 0, failedAt: null })
    vi.useRealTimers()
  })

  const status = () => useSaveStatusStore.getState()

  const httpError = (code: number) => Object.assign(new Error('boom'), { response: { status: code } })

  describe('通ったとき', () => {
    it('結果をそのまま返す', async () => {
      await expect(persist(() => Promise.resolve('ok'))).resolves.toBe('ok')
    })

    it('失敗として数えない', async () => {
      await persist(() => Promise.resolve(1))

      expect(status().failed).toBe(0)
      expect(status().pending).toBe(0)
    })
  })

  describe('落ちたとき', () => {
    it('一度だけやり直す', async () => {
      const run = vi.fn().mockRejectedValueOnce(new Error('切断')).mockResolvedValue('ok')

      await expect(persist(run)).resolves.toBe('ok')

      expect(run).toHaveBeenCalledTimes(2)
      expect(status().failed).toBe(0)
    })

    it('やり直しても駄目なら諦めて、失敗として数える', async () => {
      const run = vi.fn().mockRejectedValue(new Error('切断'))

      await expect(persist(run)).resolves.toBeNull()

      expect(run).toHaveBeenCalledTimes(2)
      expect(status().failed).toBe(1)
      expect(status().failedAt).not.toBeNull()
    })

    it('**投げない**（呼び出し側は描画の途中にいる）', async () => {
      await expect(persist(() => Promise.reject(new Error('切断')))).resolves.toBeNull()
    })

    it('諦めたときに、画面を戻す手を呼ぶ', async () => {
      const onGiveUp = vi.fn()

      await persist(() => Promise.reject(new Error('切断')), { onGiveUp })

      expect(onGiveUp).toHaveBeenCalledTimes(1)
    })

    it('通ったときは、戻す手を呼ばない', async () => {
      const onGiveUp = vi.fn()

      await persist(() => Promise.resolve('ok'), { onGiveUp })

      expect(onGiveUp).not.toHaveBeenCalled()
    })
  })

  // やり直しても同じ結果になるものを待つのは、気づくのが遅れるだけ
  describe('やり直さない失敗', () => {
    it.each([400, 403, 404, 422])('%i は即あきらめる', async (code) => {
      const run = vi.fn().mockRejectedValue(httpError(code))

      await persist(run)

      expect(run).toHaveBeenCalledTimes(1)
      expect(status().failed).toBe(1)
    })

    it.each([408, 429, 500, 503])('%i はやり直す', async (code) => {
      const run = vi.fn().mockRejectedValue(httpError(code))

      await persist(run)

      expect(run).toHaveBeenCalledTimes(2)
    })

    it('通信が切れている（status を持たない）ときはやり直す', async () => {
      const run = vi.fn().mockRejectedValue(new Error('Network Error'))

      await persist(run)

      expect(run).toHaveBeenCalledTimes(2)
    })
  })

  describe('数え方', () => {
    it('保存中の数は、終われば必ず 0 に戻る', async () => {
      await Promise.all([
        persist(() => Promise.resolve(1)),
        persist(() => Promise.reject(new Error('x'))),
      ])

      expect(status().pending).toBe(0)
    })

    it('**成功しても失敗の数は消えない**（消えた操作は別の成功では戻らない）', async () => {
      await persist(() => Promise.reject(new Error('x')))
      await persist(() => Promise.resolve('ok'))

      expect(status().failed).toBe(1)
    })

    it('閉じると 0 に戻り、次の失敗でまた出る', async () => {
      await persist(() => Promise.reject(new Error('x')))
      status().dismiss()
      expect(status().failed).toBe(0)

      await persist(() => Promise.reject(new Error('x')))
      expect(status().failed).toBe(1)
    })

    it('複数落ちたら、その数だけ数える', async () => {
      await Promise.all([
        persist(() => Promise.reject(httpError(400))),
        persist(() => Promise.reject(httpError(400))),
        persist(() => Promise.reject(httpError(400))),
      ])

      expect(status().failed).toBe(3)
    })
  })

  describe('やり直しを止める', () => {
    it('retries: 0 なら一度きり（順番が崩れると困る操作向け）', async () => {
      const run = vi.fn().mockRejectedValue(new Error('切断'))

      await persist(run, { retries: 0 })

      expect(run).toHaveBeenCalledTimes(1)
    })
  })
})
