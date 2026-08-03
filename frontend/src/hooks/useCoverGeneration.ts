'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useBillingStore } from '@/stores/billing'

type CoverGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | null | undefined

const POLL_INTERVAL_MS = 3000
const FAILED_MESSAGE = '生成に失敗しました。時間を置いてお試しください。'

/**
 * カバー画像の生成を受け付けて、出来上がるまで待つ。
 *
 * 画像は非同期に作られるので、受け付けた直後はまだ絵が無い。
 * 出来上がるまで取り直し、終わったら残クレジットの表示も更新する。
 *
 * キャンバス・スペース・ボックスで同じ振る舞いにするため、
 * 「何を送るか」「何を取り直すか」だけを引数で受け取る。
 */
export function useCoverGeneration({
  status,
  statusError,
  submit,
  reload,
}: {
  status: CoverGenerationStatus
  /** サーバーが返した失敗理由 */
  statusError?: string | null
  submit: (prompt: string, style: string) => Promise<void>
  reload: () => Promise<void>
}) {
  // 送信そのものが失敗したとき（残高不足・不適切な語など）の理由
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [tick, setTick] = useState(0)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)

  const waiting = status === 'pending' || status === 'processing'
  const generating = submitting || waiting
  // 表示する理由は状態から導く（効果の中で持ち回らない）
  const error = submitError ?? (status === 'failed' ? (statusError ?? FAILED_MESSAGE) : null)

  // 出来上がるまで取り直す。取り直すたびに tick が進んで次の回を予約し、
  // 生成が終われば予約しないので自然に止まる。
  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(() => {
      reload()
        .catch(() => {})
        .finally(() => setTick((n) => n + 1))
    }, POLL_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [waiting, tick, reload])

  // 生成が終わった瞬間に残クレジットを取り直す
  const wasWaiting = useRef(false)
  useEffect(() => {
    if (wasWaiting.current && !waiting) fetchBilling()
    wasWaiting.current = waiting
  }, [waiting, fetchBilling])

  const generate = useCallback(
    async (prompt: string, style: string) => {
      if (!prompt || generating) return
      setSubmitting(true)
      setSubmitError(null)
      try {
        // 受け付けられると状態が pending になるので、以後は取り直しが引き継ぐ
        await submit(prompt, style)
        fetchBilling()
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } }
        setSubmitError(e?.response?.data?.error ?? '生成を受け付けられませんでした。時間を置いてお試しください。')
      } finally {
        setSubmitting(false)
      }
    },
    [generating, submit, fetchBilling]
  )

  return { generating, error, generate }
}
