import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { HeroDescription, type HeroDescriptionVariant } from '@/components/features/landing/HeroDescription'

// LP検討用デモ: ヒーロー説明文の見せ方の比較ページ。
//
// 実際のヒーロー画像の上で並べる。単色の上で比べても意味がない。
// 効くかどうかは背景の明暗で決まるので、明るいところ（空・石畳）と
// 暗いところ（扉・柱の陰）の両方に当てる。
//
// 幅も両方見る。字が小さくなるほど、白の靄も縁も不利になる。

export const metadata: Metadata = {
  title: 'ヒーロー説明文の見せ方（検討用）',
  robots: { index: false, follow: false },
}

// 背景の明暗で結果が変わるので、当てる場所を変えて見せる
const SPOTS = [
  { label: '明部（空・石畳）', position: 'center 18%' },
  { label: '暗部（扉・柱の陰）', position: 'center 62%' },
]

// 画面幅も両方。モバイルは実機に近い 390px で切る
const WIDTHS = [
  { label: 'PC', width: undefined as number | undefined },
  { label: 'モバイル(390px)', width: 390 },
]

// 本番ヒーローのアイボリースクリム（globals.css の .hero-scrim と同じ値）。
// 白文字はこれの有無で結果がまるで変わるので、重ねた場合も見られるようにする
const HERO_SCRIM =
  'linear-gradient(180deg, rgba(255,253,247,0.88) 0%, rgba(255,253,247,0.6) 45%, rgba(255,253,247,0.18) 100%)'

function Stage({
  position,
  width,
  scrim,
  children,
}: {
  position: string
  width?: number
  scrim?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="relative isolate overflow-hidden rounded-lg"
      style={{ minHeight: 300, maxWidth: width, marginInline: width ? 'auto' : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-palace.webp?v=2"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: position }}
      />
      {scrim && <div aria-hidden className="absolute inset-0" style={{ background: HERO_SCRIM }} />}
      <div className="relative flex min-h-[300px] items-center justify-center px-4 py-6">{children}</div>
    </div>
  )
}

/** 案ひとつを、明暗 × 幅 の4通りで並べる */
function Matrix({
  variant,
  washOpacity,
  scrim,
}: {
  variant: HeroDescriptionVariant
  washOpacity?: number
  scrim?: boolean
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {SPOTS.map((spot) =>
        WIDTHS.map((w) => (
          <div key={`${spot.label}-${w.label}`} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {spot.label} / {w.label}
            </p>
            <Stage position={spot.position} width={w.width} scrim={scrim}>
              <HeroDescription variant={variant} washOpacity={washOpacity} />
            </Stage>
          </div>
        )),
      )}
    </div>
  )
}

function Section({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {children}
    </section>
  )
}

export default function HeroTextProposalsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-16 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>
          LP 検討用
        </p>
        <h1 className="text-2xl font-bold tracking-tight">ヒーロー説明文の見せ方</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          目標は「白い箱の上に文章がある」ではなく、
          <strong className="text-foreground">背景の上に直接文字があるように見えるのに、なぜか読みやすい</strong>
          状態。 面としての存在感より、背景との一体感を優先する。
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          そのため矩形の紙はやめ、<strong className="text-foreground">縁のない白い靄</strong>にした。
          薄くしても縁がある限り箱に見えるので、外へ向けて消している。
          濃さは <code className="rounded bg-muted px-1">--hero-wash-a</code>、
          白縁の太さは <code className="rounded bg-muted px-1">--outline-w</code>（globals.css）。
        </p>
      </header>

      <Section
        title="案C-12%（いちばん薄い）"
        body="靄がほぼ見えない。背景は最大限そのまま。明部で字が負けないかが分かれ目。"
      >
        <Matrix variant="wash" washOpacity={0.12} />
      </Section>

      <Section
        title="案C-15%（本命候補）"
        body="靄があると言われれば分かる程度。明部でも字の輪郭が残りやすい。"
      >
        <Matrix variant="wash" washOpacity={0.15} />
      </Section>

      <Section title="案C-18%（前回の濃さ・参考）" body="ここまで来ると、面があることが分かる。">
        <Matrix variant="wash" washOpacity={0.18} />
      </Section>

      <Section
        title="案D-白文字（にじむ影のみ）"
        body="いちばん単純。黒い縁は引かない ── 白字に黒縁は輪郭が硬く、字幕やゲームUIの見え方になる。にじむ影なら輪郭は立たず、字の後ろだけが沈む。"
      >
        <Matrix variant="white" />
      </Section>

      <Section
        title="案E-白文字＋黒い靄"
        body="案Cの明暗を反転したもの。靄の作り（縁を作らず外へ消す）は同じ。明部でも字が保つ代わりに、背景がわずかに沈む。"
      >
        <Matrix variant="whiteWash" washOpacity={0.22} />
      </Section>

      <Section
        title="⚠ 白文字を、本番のスクリムに重ねた場合"
        body="本番のヒーローは上端88%のアイボリースクリムが掛かっている。説明文が置かれる高さは地がほぼアイボリーなので、そこでは白字が消える。白文字系を採るなら、スクリムのほうを弱めるのが前提になる。"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">案D-白文字 + 本番スクリム</p>
            <Stage position="center 18%" scrim>
              <HeroDescription variant="white" />
            </Stage>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">案E-白文字＋黒い靄 + 本番スクリム</p>
            <Stage position="center 18%" scrim>
              <HeroDescription variant="whiteWash" washOpacity={0.22} />
            </Stage>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">案C-15%（比較用）+ 本番スクリム</p>
            <Stage position="center 18%" scrim>
              <HeroDescription variant="wash" washOpacity={0.15} />
            </Stage>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">案A-現行 + 本番スクリム</p>
            <Stage position="center 18%" scrim>
              <HeroDescription variant="panel" />
            </Stage>
          </div>
        </div>
      </Section>

      <Section
        title="参考: 案B 縁取りのみ（靄なし）"
        body="背景は完全にそのまま。明部で縁が背景に溶けると、字幕のような見え方になる。"
      >
        <Matrix variant="outline" />
      </Section>

      <Section title="参考: 案A 半透明の紙（現行の本番）" body="読みやすさは最上。ただし中央を大きく覆う。">
        <Matrix variant="panel" />
      </Section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">見るときの勘どころ</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">まず靄の縁を探す。</strong>
            どこまでが靄か分かってしまったら濃すぎる。「言われれば分かる」で止める。
          </li>
          <li>
            <strong className="text-foreground">画数の多い字を見る。</strong>
            「憶」「繰」「験」で、内側の隙間が白く埋まっていないか。埋まっていれば縁が太い。
          </li>
          <li>
            <strong className="text-foreground">モバイルの明部がいちばん厳しい。</strong>
            字が小さく、背景が明るく、靄も薄い。ここで読めれば他は読める。
          </li>
        </ul>
      </section>
    </main>
  )
}
