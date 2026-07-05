import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './road-animations.css'

// LP検討用デモ: 「道をループして進む」アニメーション3案の比較ページ。
// 純CSSアニメーションのみ（JSなし）。案Aを LP 本体へ採用済み。演出検討の記録として残す。

export const metadata: Metadata = {
  title: '道アニメーション3案（検討用）',
  robots: { index: false, follow: false },
}

// 案Cの一周ルート。CSS 側の offset-path と同一座標を使うこと
const LOOP_PATH =
  'M 200 258 C 96 258 44 216 44 158 C 44 100 120 96 200 96 C 280 96 356 92 356 150 C 356 208 304 258 200 258 Z'

// 道すがらの立ち寄りスポット（カード=記憶の比喩）
const LOOP_SPOTS = [
  { cx: 44, cy: 158 },
  { cx: 200, cy: 96 },
  { cx: 356, cy: 150 },
  { cx: 200, cy: 258 },
]

function Proposal({
  label,
  title,
  body,
  children,
}: {
  label: string
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <section className="mx-auto w-full max-w-3xl">
      <p className="mb-2 text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>
        {label}
      </p>
      <h2 className="mb-2 text-2xl font-bold tracking-tight" style={{ color: '#111111' }}>
        {title}
      </h2>
      <p className="mb-6 text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
        {body}
      </p>
      <div className="rad-stage">{children}</div>
    </section>
  )
}

export default function RoadAnimationsPage() {
  return (
    <div className="flex flex-col gap-20 px-6 py-16" style={{ backgroundColor: 'var(--ivory)' }}>
      <header className="mx-auto w-full max-w-3xl">
        <h1 className="mb-3 text-3xl font-bold tracking-tight" style={{ color: '#111111' }}>
          道ループアニメーション 3案
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          LP向け「道をループして進む」演出の比較デモ。すべて純CSSの無限ループで、
          prefers-reduced-motion 時は静止します。
        </p>
      </header>

      <Proposal
        label="案A"
        title="一人称の道"
        body="道の上に立ち、地平線へ向かって歩き続ける視点。既存の俯瞰トレッドミルを3D遠近に起こし、視点のわずかな上下で「歩いている」感触を足しています。ヒーローのズーム演出と地続きの没入感。"
      >
        <div className="rad-a__bob">
          <div className="rad-a__scene" aria-hidden>
            <div className="rad-a__plane" />
          </div>
          <div className="rad-a__haze" aria-hidden />
        </div>
      </Proposal>

      <Proposal
        label="案B"
        title="足あとの道"
        body="現行LPと同じ俯瞰の道が自動で流れ、そこへ左右交互の足あとが刻まれては薄れていきます。足あとは道と同じ速度で流れるため「道に刻んで進んでいる」ように見える、静かで控えめな案。"
      >
        <div className="rad-b__mask" aria-hidden>
          <div className="rad-b__strip" />
        </div>
        <div aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className={`rad-b__foot ${i % 2 === 0 ? 'rad-b__foot--l' : 'rad-b__foot--r'}`}
              style={{ animationDelay: `${i * 0.75}s` }}
            />
          ))}
        </div>
      </Proposal>

      <Proposal
        label="案C"
        title="巡る道"
        body="曲がりくねった一周の道を、金色の旅人が巡り続ける俯瞰マップ。道すがらのスポット（＝記憶のカード）に立ち寄りながら進むイメージで、「宮殿を育てる旅」の物語性をいちばん直接的に描ける案。"
      >
        <div className="rad-c__frame" aria-hidden>
          <svg className="rad-c__svg" viewBox="0 0 400 320" fill="none">
            {/* 道の本体（石畳色の太いストローク） */}
            <path d={LOOP_PATH} stroke="#DDD0B8" strokeWidth={26} strokeLinecap="round" />
            {/* 進行方向へ流れる中央の破線 */}
            <path
              className="rad-c__dash"
              d={LOOP_PATH}
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeDasharray="10 16"
              strokeLinecap="round"
            />
            {/* 立ち寄りスポット */}
            {LOOP_SPOTS.map((s) => (
              <circle
                key={`${s.cx}-${s.cy}`}
                cx={s.cx}
                cy={s.cy}
                r={7}
                fill="var(--ivory)"
                stroke="var(--palace)"
                strokeWidth={2.5}
              />
            ))}
          </svg>
          <div className="rad-c__walker" />
        </div>
      </Proposal>
    </div>
  )
}
