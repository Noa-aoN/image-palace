import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Brain, Layers, Search, GalleryVerticalEnd } from 'lucide-react'
import { LandingFooter } from '@/components/features/layout/LandingFooter'
import { HeroScrollZoom } from '@/components/features/landing/HeroScrollZoom'
import { LandingCta } from '@/components/features/landing/LandingCta'
import { ScrollCue } from '@/components/features/landing/ScrollCue'
import { SectionDivider } from '@/components/features/landing/SectionDivider'
import { RoadBackground } from '@/components/features/landing/RoadBackground'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

export const metadata: Metadata = {
  title: { absolute: 'ImagePalace — 単語をイメージに変換して記憶できるサービス' },
}

// 検索エンジン向けの構造化データ（schema.org WebApplication）。
// リッチリザルト対象になりやすく、サービスの種別・無料提供を機械可読にする。
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  inLanguage: 'ja',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'JPY',
  },
}

const FEATURES = [
  { icon: <Brain size={20} />, title: 'イメージで記憶', body: '無機質な単語を視覚的な手がかりに変え、思い出しやすくします。' },
  { icon: <Layers size={20} />, title: '自由に整理', body: 'キャンバス・ボックス・スペースで、知識を自分の構造にまとめられます。' },
  { icon: <Search size={20} />, title: 'すぐ探せる', body: 'タグと検索で、必要なカードをすぐに引き出せます。' },
]

// HA（ヒーロー）と同じく全画面サイズのセクション。内容は仮埋め。
// data-anim-layer は今後アニメーションを重ねるための空レイヤー。
function Section({
  id,
  bg,
  cueTo,
  topDividerFrom,
  roadFadeTop,
  roadFadeBottom,
  roadIntro,
  className,
  children,
}: {
  id?: string
  bg?: string
  cueTo?: string
  topDividerFrom?: string
  /** 最初のセクションで指定: ヒーロー境界で道をフェードイン */
  roadFadeTop?: boolean
  /** 最後のセクションで指定: フッター境界で道をフェードアウト */
  roadFadeBottom?: boolean
  /** 最初のセクションで指定: 道の出現前の余白に渡鴉＋足跡の誘導演出を出す */
  roadIntro?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={`relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center${className ? ` ${className}` : ''}`}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      <div aria-hidden data-anim-layer className="pointer-events-none absolute inset-0 z-0">
        {/* 全セクションで同一ビューの道ステージを clip して見せる（1つの道が貫く）。
            ヒーローは Section を通らないため対象外 */}
        <RoadBackground fadeTop={roadFadeTop} fadeBottom={roadFadeBottom} intro={roadIntro} />
      </div>
      {topDividerFrom && <SectionDivider fill={topDividerFrom} />}
      <div className="relative z-10 mx-auto w-full max-w-4xl">{children}</div>
      {cueTo && <ScrollCue targetId={cueTo} className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2" />}
    </section>
  )
}

export default function TopPage() {
  return (
    <div className="flex flex-col flex-1">
      <script
        type="application/ld+json"
        // 静的な定数のみ埋め込む（ユーザー入力を含まないため XSS リスクなし）
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      {/* HA: ヒーロー（スクロール連動ズーム） */}
      <HeroScrollZoom />

      {/* 1. コンセプト（仮）。ヒーロー終盤へ少しだけ重ね、余白を程よく詰める */}
      <Section id="concept" cueTo="features" bg="var(--ivory)" roadFadeTop roadIntro className="-mt-[10svh]">
        <p className="mb-4 text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>CONCEPT</p>
        <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>
          イメージで記憶する。
        </h2>
        <p className="mx-auto max-w-xl text-base leading-relaxed md:text-lg" style={{ color: '#4A4A4A' }}>
          テキスト中心の学習に違和感を持つ人へ。単語や概念をAIでイメージに変換し、
          視覚的に保持・想起できる「自分だけの記憶の宮殿」を育てます。
        </p>
        {/* 定量的な裏づけ（絵優位性・視覚記憶の容量） */}
        <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
          人は約<span className="font-bold" style={{ color: 'var(--palace)' }}>1万枚</span>もの画像を見分けられる——
          記憶はもともと、文字よりイメージに強い。
          <span className="mt-1 block text-xs text-muted-foreground">出典: Standing (1973), Learning 10,000 pictures</span>
        </p>
      </Section>

      {/* 2. 機能（仮） */}
      <Section id="features" cueTo="gallery" bg="var(--ivory-dark)" topDividerFrom="var(--ivory)">
        <p className="mb-4 text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>FEATURES</p>
        <h2 className="mb-12 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>できること</h2>
        <div className="grid gap-6 text-left md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-card px-6 py-8" style={{ border: '1px solid var(--palace)' }}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}>
                {f.icon}
              </div>
              <h3 className="mb-2 font-semibold" style={{ color: '#111111' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. 作例（仮） */}
      <Section id="gallery" cueTo="cta" bg="#ffffff" topDividerFrom="var(--ivory-dark)">
        <p className="mb-4 text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>GALLERY</p>
        <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>画面イメージ</h2>
        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: '#4A4A4A' }}>
          実際の画面例をここに並べます。（スクリーンショットは準備中）
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {['カード生成', 'フリーボード', '接続線・レイヤー', 'スペース（記憶の宮殿）'].map((label) => (
            <figure key={label} className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm">
              {/* スクショ枠のフェイクタイトルバー */}
              <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
              </div>
              <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-muted/30">
                <GalleryVerticalEnd size={28} className="text-muted-foreground/40" />
                <figcaption className="text-sm font-medium text-muted-foreground">{label}</figcaption>
                <span className="text-xs text-muted-foreground/70">スクリーンショット準備中</span>
              </div>
            </figure>
          ))}
        </div>
      </Section>

      {/* 4. 再度の入り口（仮） */}
      <Section id="cta" bg="var(--ivory)" topDividerFrom="#ffffff" roadFadeBottom>
        <h2 className="mb-8 text-2xl font-bold md:text-3xl" style={{ color: '#111111' }}>
          今日から、記憶を育てはじめましょう。
        </h2>
        {/* ヒーローと同じくログイン有無で出し分ける */}
        <LandingCta className="flex w-full max-w-sm flex-col items-center gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:justify-center" />
      </Section>

      <LandingFooter />
    </div>
  )
}
