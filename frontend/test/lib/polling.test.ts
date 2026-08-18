import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/*
  出来上がりを待つポーリングの決まりごと。

  以前は `setInterval` で、
    ・裏のタブでも叩き続ける
    ・`await` が落ちても捕まえない
    ・止まる条件が親の旗だけ
  という形だった。親が旗を落とし損ねると**永久に回る**。

  ここでは、直したあとの形（1回ずつ次を約束する／見えない間は休む／
  数えた回数で必ず終わる）を、時計を進めて確かめる。
*/
describe('待ち受けの回り方', () => {
  const INTERVAL = 3000
  const HIDDEN = 15000
  const MAX = 100

  let hidden = false
  beforeEach(() => {
    vi.useFakeTimers()
    hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  })
  afterEach(() => vi.useRealTimers())

  /** 直したあとの形（実装と同じ組み立て） */
  function startPolling(fetchOnce: () => Promise<unknown>) {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const tick = async () => {
      if (!alive) return
      if (document.hidden) {
        timer = setTimeout(tick, HIDDEN)
        return
      }
      try {
        await fetchOnce()
      } catch {
        // 取れなくても回り続ける
      }
      if (!alive) return
      tries += 1
      if (tries < MAX) timer = setTimeout(tick, INTERVAL)
    }
    timer = setTimeout(tick, INTERVAL)
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }

  it('落ちても止まらない（生成はサーバー側で進んでいる）', async () => {
    const run = vi.fn().mockRejectedValue(new Error('切断'))
    startPolling(run)

    for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(INTERVAL)

    expect(run).toHaveBeenCalledTimes(3)
  })

  it('**必ず終わる**（回数を数えて打ち切る）', async () => {
    const run = vi.fn().mockResolvedValue({})
    startPolling(run)

    await vi.advanceTimersByTimeAsync(INTERVAL * (MAX + 20))

    expect(run).toHaveBeenCalledTimes(MAX)
  })

  it('見えていないタブでは取りに行かない', async () => {
    const run = vi.fn().mockResolvedValue({})
    startPolling(run)
    hidden = true

    await vi.advanceTimersByTimeAsync(INTERVAL * 3)

    expect(run).not.toHaveBeenCalled()
  })

  it('タブが戻れば再開する', async () => {
    const run = vi.fn().mockResolvedValue({})
    startPolling(run)
    hidden = true
    await vi.advanceTimersByTimeAsync(HIDDEN * 2)
    expect(run).not.toHaveBeenCalled()

    hidden = false
    await vi.advanceTimersByTimeAsync(HIDDEN)

    expect(run).toHaveBeenCalled()
  })

  it('外したら次は来ない', async () => {
    const run = vi.fn().mockResolvedValue({})
    const stop = startPolling(run)

    stop()
    await vi.advanceTimersByTimeAsync(INTERVAL * 5)

    expect(run).not.toHaveBeenCalled()
  })

  it('前の呼び出しが返る前に次を出さない', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const run = vi.fn().mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, INTERVAL * 2)) // 間隔より長くかかる
      inFlight -= 1
    })
    startPolling(run)

    await vi.advanceTimersByTimeAsync(INTERVAL * 10)

    expect(maxInFlight).toBe(1)
  })
})
