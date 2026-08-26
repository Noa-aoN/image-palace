'use client'

import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import {
  fetchContentPackages,
  installContentPackage,
  type ContentPackageSummary,
} from '@/lib/api/contentPackages'

/**
 * 最初のカードを受け取る札。**エントランスに置く。**
 *
 * **空の宮殿から始めない。** 何も無い状態で「作ってみましょう」と言われても、
 * 何を作ればよいのか分からない。誰かが作ったひとまとまりが1つあると、
 * 見て回れるし、真似もできる。
 *
 * 体験の宮殿から来た人には特に効く。**体験で見たものは引き継がれない**が、
 * 同じ中身をここで受け取れる。
 *
 * ## 登録直後の案内には入れない
 *
 * 案内は5枚までと決めてある（読む前に使わせないため）。
 * ここに足すと6枚になる。だから案内を抜けた先に置く。
 *
 * ## いつ消えるか
 *
 * 無料枠を使ったら出さない。使わない人のために「あとで」も置く
 * （押すとこの端末では出さなくなる。デルフォイからいつでも受け取れる）。
 */
const DISMISSED = 'starter.dismissed'

export function StarterCard() {
  const [packages, setPackages] = useState<ContentPackageSummary[] | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [received, setReceived] = useState<{ name: string; items: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED) === '1')
    } catch {
      setDismissed(false)
    }

    fetchContentPackages()
      .then((data) => {
        setPackages(data.packages)
        setRemaining(data.free_remaining)
      })
      .catch(() => setError('いま受け取れるものを読めませんでした'))
  }, [])

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED, '1')
    } catch {
      // 覚えられなくても、受け取り自体はできる
    }
    setDismissed(true)
  }

  async function receive(pkg: ContentPackageSummary) {
    if (busy) return
    setBusy(pkg.key)
    setError(null)
    try {
      const result = await installContentPackage(pkg.key)
      setReceived({ name: pkg.name, items: result.created + result.reused })
    } catch (e) {
      const message = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      setError(message ?? '受け取れませんでした')
    } finally {
      setBusy(null)
    }
  }

  // **受け取ったあとは、次に何が起きるかだけを言う。**
  // ここで別の選択肢を並べると、もらった気持ちの上に判断が乗る
  if (received) {
    return (
      <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-center">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}
        >
          <Sparkles size={22} />
        </span>
        <p className="text-base font-semibold">
          {received.items} 枚を宮殿に迎えました
        </p>
        <p className="text-sm text-muted-foreground">
          「{received.name}」が、あなたのライブラリに入っています。
          このあと宮殿を見てまわれます。
        </p>
      </section>
    )
  }

  // **出す条件を1か所にまとめる。** 読み込み中・配っていない・もう使った・断られた
  if (!packages || packages.length === 0) return null
  if (remaining === 0 || dismissed) return null

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">最初のカードを受け取る</h2>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          あとで
        </button>
      </div>
      <p className="text-sm leading-relaxed">
        できあいのひとまとまりを、1つ受け取れます。
        <strong className="font-semibold">絵も意味も入った状態</strong>で宮殿に並ぶので、
        まず見て回れます。
      </p>

      {error ? (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger-deep)' }}>
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {packages.map((pkg) => (
          <li key={pkg.key}>
            <button
              type="button"
              onClick={() => receive(pkg)}
              disabled={busy !== null || pkg.received || remaining === 0}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-[var(--palace)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{pkg.name}</span>
                <span className="block text-xs text-muted-foreground">
                  カード {pkg.counts.items} 枚
                  {pkg.summary ? ` ・ ${pkg.summary}` : ''}
                </span>
              </span>
              {pkg.received ? (
                <Check size={16} style={{ color: 'var(--palace)' }} />
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {busy === pkg.key ? '迎えています…' : '受け取る'}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* **無料で受け取れる数は言い切る。** あとから「もう取れない」と知るのは遅い */}
      <p className="text-xs text-muted-foreground">
        無料で受け取れるのは1つです。あとからデルフォイでも受け取れます。
      </p>
    </section>
  )
}
