import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Brain, Gamepad2, Layers } from 'lucide-react'
import { LandingFooter } from '@/components/features/layout/LandingFooter'
import { LANDING_SHOTS } from '@/lib/landing/gallery'
import { HeroScrollZoom } from '@/components/features/landing/HeroScrollZoom'
import { LandingCtaGroup } from '@/components/features/landing/LandingCta'
import { ScrollCue } from '@/components/features/landing/ScrollCue'
import { SectionDivider } from '@/components/features/landing/SectionDivider'
import { RoadBackground } from '@/components/features/landing/RoadBackground'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

export const metadata: Metadata = {
  // ここだけ `%s | IMAGE PALACE` の型を外す。トップで名前が二度出るのを避ける
  title: { absolute: 'IMAGE PALACE — 言葉をイメージに変えて、記憶の宮殿をつくる' },
  alternates: { canonical: '/' },
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

/**
 * できること。**作る → まとめる → 使う**の順に並べる。
 * 3つ目はまだ無いので、そう書く。あるように見せると、入ってから探すことになる。
 */
/*
 * 節の中の大きさは4段。**ラベルと注釈を同じ大きさにしない**。
 *
 *   ラベル（CONCEPT 等）  12px … これは分類の札で、読ませる文ではない
 *   見出し                30/36px … いちばん言いたいこと
 *   本文                  16/18px
 *   注釈・出典            14px
 *
 * 以前はラベルと注釈がどちらも 14px で、小さいほうが二役になっていた。
 * 同じ大きさのものが違う役目を持つと、どこから読めばよいのか決まらない。
 */
const FEATURES = [
  {
    icon: <Brain size={20} />,
    title: '記憶カードを作成',
    body: '覚えたい言葉を書くと、AI がイメージにして一枚のカードにします。',
  },
  {
    icon: <Layers size={20} />,
    title: '自由に整理・組み合わせ',
    body: 'キャンバス・ボックス・スペースで、カードを自分の構造にまとめられます。',
  },
  {
    icon: <Gamepad2 size={20} />,
    title: '練習・遊戯・共有',
    note: '準備中',
    body: '繰り返し練習する、遊びながら思い出す、誰かと分け合う。順に用意していきます。',
  },
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
  roadFadeIntoNext,
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
  /** 次のセクションに区切りがある: こちらの道を下端で霞ませる */
  roadFadeIntoNext?: boolean
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
        {/* 区切りは前セクションの色で塞ぐ。道をそのまま通すと塞ぎに当たって
            直線で切れるので、境目の前後で霞ませる */}
        <RoadBackground
          fadeTop={roadFadeTop}
          fadeBottom={roadFadeBottom}
          intro={roadIntro}
          fadeUnderDivider={Boolean(topDividerFrom)}
          fadeIntoDivider={roadFadeIntoNext}
          // 門は、最後の面だけでなく**その手前の面にも**出す。
          //
          // 道は面ごとに切り抜いて見せているので、最後の面にしか置かないと、
          // その面が画面のほとんどを占めるまで門が現れない。行き先が見えるのが
          // 遅すぎて、光だけが長く続くことになる。
          //
          // 「CTA へ送る面」を印にするので、間に面が増えても付け直さずに済む
          gate={roadFadeBottom || cueTo === 'cta'}
        />
      </div>
      {topDividerFrom && <SectionDivider fill={topDividerFrom} />}
      <div className="relative z-10 mx-auto w-full max-w-4xl">{children}</div>
      {cueTo && <ScrollCue targetId={cueTo} className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2" />}
    </section>
  )
}

export default function TopPage() {
  const hasShots = LANDING_SHOTS.length > 0

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
      <Section id="concept" cueTo="features" bg="var(--ivory)" roadFadeTop roadIntro roadFadeIntoNext className="-mt-[10svh]">
        <p className="mb-4 text-xs font-medium tracking-widest" style={{ color: 'var(--palace)' }}>CONCEPT</p>
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
      <Section id="features" cueTo={hasShots ? 'gallery' : 'cta'} bg="var(--ivory-dark)" topDividerFrom="var(--ivory)" roadFadeIntoNext>
        <p className="mb-4 text-xs font-medium tracking-widest" style={{ color: 'var(--palace)' }}>FEATURES</p>
        <h2 className="mb-12 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>できること</h2>
        <div className="grid gap-6 text-left md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-card px-6 py-8" style={{ border: '1px solid var(--palace)' }}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}>
                {f.icon}
              </div>
              <h3 className="mb-2 flex flex-wrap items-center gap-1.5 font-semibold" style={{ color: '#111111' }}>
                {f.title}
                {/* まだ無いものは、そう書く。あるように見せると入ってから探すことになる */}
                {'note' in f && f.note && (
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                    {f.note}
                  </span>
                )}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. 作例。**絵が無いあいだは節ごと出さない**（LANDING_SHOTS が空なら丸ごと消える） */}
      {hasShots && (
        <Section id="gallery" cueTo="cta" bg="#ffffff" topDividerFrom="var(--ivory-dark)" roadFadeIntoNext>
          <p className="mb-4 text-xs font-medium tracking-widest" style={{ color: 'var(--palace)' }}>GALLERY</p>
          <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: '#111111' }}>画面イメージ</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LANDING_SHOTS.map((shot) => (
              <figure key={shot.src} className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm">
                {/* スクショ枠のフェイクタイトルバー */}
                <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.src} alt={shot.label} className="aspect-video w-full object-cover" loading="lazy" />
                <figcaption className="px-3 py-2 text-sm font-medium text-muted-foreground">{shot.label}</figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {/* 4. 再度の入り口（仮） */}
      {/* 区切りの色は、すぐ上の節の地色に合わせる（作例を出さないときは features の地） */}
      <Section id="cta" bg="var(--ivory)" topDividerFrom={hasShots ? '#ffffff' : 'var(--ivory-dark)'} roadFadeBottom>
        <h2 className="mb-8 text-2xl font-bold md:text-3xl" style={{ color: '#111111' }}>
          今日から、記憶を育てはじめましょう。
        </h2>
        {/* ヒーローと同じくログイン有無で出し分ける。
            下に「宮殿を見てみる」を小さく添える（並びは変えない） */}
        <LandingCtaGroup className="flex w-full max-w-sm flex-col items-center gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:justify-center" />
      </Section>

      <LandingFooter />
    </div>
  )
}
