import { describe, expect, it, beforeEach, vi } from 'vitest'
import { persist, flushPending } from '@/lib/api/persist'
import { failedCount, useSaveStatusStore } from '@/stores/saveStatus'

// キャンバスの編集は画面を先に動かしてサーバーへ後から書く。
// 書き込みが落ちても見た目が変わらないので、**言わなければ気づけない**。
// 実際 24 箇所が黙って捨てていて、リロードすると編集が消えていた。
describe('保存の見張り', () => {
  beforeEach(() => {
    useSaveStatusStore.setState({ pending: 0, queued: [], lost: 0, failedAt: null })
  })

  const state = () => useSaveStatusStore.getState()
  const failed = () => failedCount(state())
  const httpError = (code: number) => Object.assign(new Error('boom'), { response: { status: code } })

  describe('通ったとき', () => {
    it('結果をそのまま返す', async () => {
      await expect(persist(() => Promise.resolve('ok'))).resolves.toBe('ok')
    })

    it('失敗として数えない', async () => {
      await persist(() => Promise.resolve(1))

      expect(failed()).toBe(0)
      expect(state().pending).toBe(0)
    })
  })

  describe('落ちたとき', () => {
    it('一度だけやり直す', async () => {
      const run = vi.fn().mockRejectedValueOnce(new Error('切断')).mockResolvedValue('ok')

      await expect(persist(run)).resolves.toBe('ok')

      expect(run).toHaveBeenCalledTimes(2)
      expect(failed()).toBe(0)
    })

    it('やり直しても駄目なら諦めて、失敗として数える', async () => {
      const run = vi.fn().mockRejectedValue(new Error('切断'))

      await expect(persist(run)).resolves.toBeNull()

      expect(run).toHaveBeenCalledTimes(2)
      expect(failed()).toBe(1)
      expect(state().failedAt).not.toBeNull()
    })

    it('**投げない**（呼び出し側は描画の途中にいる）', async () => {
      await expect(persist(() => Promise.reject(new Error('切断')))).resolves.toBeNull()
    })

    it('諦めたときに、画面を戻す手を呼ぶ', async () => {
      const onGiveUp = vi.fn()

      await persist(() => Promise.reject(new Error('切断')), { onGiveUp })

      expect(onGiveUp).toHaveBeenCalledTimes(1)
    })
  })

  // やり直しても同じ結果になるものを待つのは、気づくのが遅れるだけ
  describe('やり直さない失敗', () => {
    it.each([400, 403, 404, 422])('%i は即あきらめる', async (code) => {
      const run = vi.fn().mockRejectedValue(httpError(code))

      await persist(run)

      expect(run).toHaveBeenCalledTimes(1)
      expect(failed()).toBe(1)
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

  // 通信が戻ったときに送り直せること。ここが 1-1 の肝
  describe('取っておいて、あとで送り直す', () => {
    it('鍵があれば取っておく', async () => {
      await persist(() => Promise.reject(httpError(500)), { key: 'view:1:item:a:pos' })

      expect(state().queued.map((w) => w.key)).toEqual(['view:1:item:a:pos'])
    })

    it('鍵が無ければ取っておかない（送り直すと壊れるものがあるため）', async () => {
      await persist(() => Promise.reject(httpError(500)))

      expect(state().queued).toEqual([])
      expect(state().lost).toBe(1)
      expect(failed()).toBe(1)
    })

    it('送り直せたら、札の数が減って消える', async () => {
      const run = vi.fn().mockRejectedValueOnce(httpError(500)).mockRejectedValueOnce(httpError(500))
      await persist(run, { key: 'k1' })
      expect(failed()).toBe(1)

      run.mockResolvedValue('ok')
      await expect(flushPending()).resolves.toBe(1)

      expect(failed()).toBe(0)
      expect(state().queued).toEqual([])
    })

    it('送り直しても駄目なら、取っておいたまま', async () => {
      const run = vi.fn().mockRejectedValue(httpError(500))
      await persist(run, { key: 'k1' })

      await expect(flushPending()).resolves.toBe(0)

      expect(state().queued.map((w) => w.key)).toEqual(['k1'])
      expect(failed()).toBe(1)
    })

    // ここを間違えると、**古い位置が後から上書きする**
    it('同じ鍵で落ちたら、新しいほうだけを残す', async () => {
      await persist(() => Promise.reject(httpError(500)), { key: 'view:1:item:a:pos' })
      await persist(() => Promise.reject(httpError(500)), { key: 'view:1:item:a:pos' })

      expect(state().queued).toHaveLength(1)
      expect(failed()).toBe(1)
    })

    it('別の鍵なら別々に取っておく', async () => {
      await persist(() => Promise.reject(httpError(500)), { key: 'a' })
      await persist(() => Promise.reject(httpError(500)), { key: 'b' })

      expect(state().queued.map((w) => w.key).sort()).toEqual(['a', 'b'])
      expect(failed()).toBe(2)
    })

    // 落ちたあとに同じ対象へ書けたなら、取ってある古いものを送ってはいけない
    it('同じ鍵で後から通ったら、取ってある古いものは捨てる', async () => {
      await persist(() => Promise.reject(httpError(500)), { key: 'view:1:item:a:pos' })
      expect(failed()).toBe(1)

      await persist(() => Promise.resolve('ok'), { key: 'view:1:item:a:pos' })

      expect(state().queued).toEqual([])
      expect(failed()).toBe(0)
    })

    it('順に送る（まとめて投げない）', async () => {
      const order: string[] = []
      const a = vi.fn().mockRejectedValue(httpError(500))
      const b = vi.fn().mockRejectedValue(httpError(500))
      await persist(a, { key: 'a' })
      await persist(b, { key: 'b' })

      a.mockImplementation(async () => { order.push('a'); return 'ok' })
      b.mockImplementation(async () => { order.push('b'); return 'ok' })
      await flushPending()

      expect(order).toEqual(['a', 'b'])
    })
  })

  describe('数え方', () => {
    it('保存中の数は、終われば必ず 0 に戻る', async () => {
      await Promise.all([
        persist(() => Promise.resolve(1)),
        persist(() => Promise.reject(httpError(400))),
      ])

      expect(state().pending).toBe(0)
    })

    it('閉じると 0 に戻り、取ってあるものも捨てる', async () => {
      await persist(() => Promise.reject(httpError(500)), { key: 'k' })

      state().dismiss()

      expect(failed()).toBe(0)
      expect(state().queued).toEqual([])
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
