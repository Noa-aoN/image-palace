'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  fetchContentPackages,
  installContentPackage,
  type ContentPackageSummary,
} from '@/lib/api/contentPackages'
import { availability, describeCounts, headlineCount } from '@/lib/content-packages/summary'

/**
 * 公式コンテンツの受け取り。
 *
 * **専用の店構えにはしない。** デルフォイの他の節と同じ見た目に収める。
 *
 * 表紙の絵はまだ無い。「？」のままにしてあるのは、手抜きではなく
 * **何が届くのだろう、という宝箱の感じ**と噛み合うため。
 * 受け取られ方を見てから、実物の絵・寄せ集め・ぼかしを試せばよい。
 */
export function OfficialContentSection() {
  const router = useRouter()
  const [packages, setPackages] = useState<ContentPackageSummary[]>([])
  const [freeRemaining, setFreeRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchContentPackages()
      .then((data) => {
        setPackages(data.packages)
        setFreeRemaining(data.free_remaining)
      })
      // 受け取り口が開けなくても、デルフォイの他の節は使える
      .catch(() => setPackages([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleInstall(pkg: ContentPackageSummary) {
    if (installing) return

    setInstalling(pkg.key)
    setError(null)
    try {
      const result = await installContentPackage(pkg.key)
      // 受け取ったら、そのまま見に行ける
      if (result.box_id) router.push(`/boxes/${result.box_id}`)
      else router.push('/library')
    } catch (e) {
      const message = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(message ?? '受け取れませんでした。時間を置いてお試しください')
      setInstalling(null)
    }
  }

  // 配るものが無いときは、節ごと出さない。
  // **「ありません」と書いた枠が並ぶより、無いほうがよい**
  if (loading) {
    return (
      <section className="mt-6 flex justify-center py-6">
        <Spinner />
      </section>
    )
  }
  if (packages.length === 0) return null

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">公式コンテンツの受け取り</h2>
        <p className="text-xs text-muted-foreground">
          {freeRemaining > 0 ? `あと${freeRemaining}つ、無料で受け取れます` : '受け取り済みです'}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        運営が用意したカードのまとまりです。受け取ると、あなたの宮殿へ加わります。
      </p>

      {error ? (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger-deep)' }}>
          {error}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => {
          const state = availability(pkg, freeRemaining)
          return (
            <li
              key={pkg.key}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4"
            >
              {/* 表紙。まだ絵が無いので、何が届くか分からない感じを残す */}
              <div
                className="flex h-24 items-center justify-center rounded-md text-3xl"
                style={{ backgroundColor: 'var(--ivory-dark)', color: 'var(--palace)' }}
                aria-hidden="true"
              >
                ？
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium">{pkg.name}</h3>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {headlineCount(pkg.counts)}
                  </span>
                </div>
                {pkg.summary ? (
                  <p className="text-xs text-muted-foreground">{pkg.summary}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {describeCounts(pkg.counts).join(' / ')}
                </p>
              </div>

              {state.canInstall ? (
                <Button
                  size="sm"
                  onClick={() => handleInstall(pkg)}
                  disabled={installing !== null}
                  className="w-full"
                >
                  {installing === pkg.key ? '受け取っています…' : '受け取る'}
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">{state.message}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
