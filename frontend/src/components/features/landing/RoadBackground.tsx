'use client'

import { useEffect, useRef, type CSSProperties } from 'react'

// 「続く1本の道を歩く」体験（3D遠近版・デモ /dev/road-animations の案A採用）。
// 道のステージは position: fixed でビューポートに固定し、親 .road-bg の
// clip-path でセクション範囲だけを見せる。全セクションのステージが同一の
// ビュー（同じ --road-shift・同じ画角）を映すため、セクション境界で道が
// 完全に連続し「1つの道を進み続ける」ように見える。
// スクロール量に応じてテクスチャの background-position を縦に流す
// （トレッドミル）。スクロールを戻せば道も戻る。repeat-y が継ぎ目なく
// 折り返すため無限ループ。
// 道の両脇には一定間隔で柱を立てる。柱は道と同じオフセットで手前に流れ、
// 平面長 2160px で折り返す（CSS mod()）。
// prefers-reduced-motion 時は listener を張らず静止。

const SPEED = 0.6 // スクロール量に対する道の流れる速さ（歩行速度）

// 柱の配置（左右対称の対＝宮殿の参道、360px間隔）。平面長 2160 はタイル高(1080)の
// 倍数なので、道の折り返しと柱の折り返し(mod 2160)が同期する
const PILLAR_BASES = [0, 360, 720, 1080, 1440, 1800]
const PILLAR_SIDES = ['l', 'r'] as const

// 足跡の並び（手前→奥）。左右交互に、道の遠近に合わせて奥ほど中央へ
// 収束しながら小さくなる。手前ほど左右に開き・サイズも大きい。
// 画面中下段（71%）から道の最上部あたり（36%）まで歩幅も奥ほど詰まる（遠近感）。
// i はスタガー用のインデックス（0 が最初に現れる手前の一歩）
// 左右の開きは道と同じ遠近の平行線: 消失点（y≈20%）へ向かう2本の
// 直線上に乗るよう、横ずれ量を (y - 20%) に比例させている
const INTRO_STEPS = [
  { i: 0, x: '43.3%', y: '71%', s: 1.2, side: 'l' },
  { i: 1, x: '55.6%', y: '62%', s: 0.95, side: 'r' },
  { i: 2, x: '45.9%', y: '54%', s: 0.76, side: 'l' },
  { i: 3, x: '53.4%', y: '47%', s: 0.59, side: 'r' },
  { i: 4, x: '47.7%', y: '41%', s: 0.45, side: 'l' },
  { i: 5, x: '51.8%', y: '36%', s: 0.35, side: 'r' },
] as const

type RoadBackgroundProps = {
  /** 最初のセクション用: 上端（ヒーローとの境界）で道をフェードインさせる */
  fadeTop?: boolean
  /** 最後のセクション用: 下端（フッターとの境界）で道をフェードアウトさせる */
  fadeBottom?: boolean
  /** 最初のセクション用: 道の出現前の余白に渡鴉＋足跡の誘導アニメーションを出す */
  intro?: boolean
}

export function RoadBackground({ fadeTop, fadeBottom, intro }: RoadBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // 初回リビールの基準点。ステージはセクション領域でクリップされるため、
    // セクションが画面をほぼ覆い「地平線が画面内に入る」まで待ってから
    // リビールを始める（早く始めるとクリップの都合で手前側から見えてしまう）。
    // 基準はヒーロー終端 + 0.4 画面分。この値は「道の自然な遠端（遠方フェードが
    // 明けるあたり・画面上 約50%）がセクションのクリップ内に入る瞬間」に合わせて
    // おり、道は必ず表示エリアの最上端から見え始めて手前へ伸びる。
    // 全インスタンスが同じ値を参照することで固定ステージの同期が保たれる。
    // 0.75 画面分のスクロールで奥→手前へ伸びきる。
    let revealStart = 0
    let revealLen = 1
    let introAppearStart = 0
    let introAppearLen = 1
    let introFadeStart = 0
    let introFadeLen = 1
    let walkStart = 0
    let walkLen = 1
    let topOutStart = 0
    let topOutLen = 1
    const measure = () => {
      const hero = document.querySelector<HTMLElement>('.hero-track')
      const ih = window.innerHeight
      const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - ih : 0
      revealStart = heroEnd + ih * 0.4
      revealLen = ih * 0.75
      // 誘導演出（渡鴉＋足跡）はホワイトアウトが満ちる終盤（ヒーロー終端の
      // 少し手前）にホワイトアウトの上へフェードインし、道リビールの少し
      // 手前から消え始めて concept のテキストが画面に入る頃には消えている
      introAppearStart = heroEnd - ih * 0.06
      introAppearLen = ih * 0.1
      // 退場は「CONCEPT」ラベルが足跡の高さにかかる頃から。
      // それまで足跡は道の上に残り続ける
      introFadeStart = heroEnd + ih * 0.45
      introFadeLen = ih * 0.45
      // 足跡の歩行進行（スクロール連動・一回きり）。レイヤーが見えてから
      // 1歩目、0.6画面分のスクロールでとてもゆっくり最奥の一歩まで現れ切る
      // （最奥が現れ切るのは CONCEPT 到達による退場開始の直前）
      walkStart = heroEnd - ih * 0.02
      walkLen = ih * 0.6
      // 道の表示が足跡へ十分重なってから、奥（上）の足跡も道に
      // 飲み込まれるように上からゆっくり消していく（手前側の退場より遅い）
      topOutStart = revealStart + ih * 0.3
      topOutLen = ih * 0.4
    }

    let raf = 0
    const update = () => {
      raf = 0
      // 下へスクロール＝道が手前(下)へ流れる＝前進。repeat-y が自動で折り返す。
      el.style.setProperty('--road-shift', (window.scrollY * SPEED).toFixed(1))
      // 初回リビール（0=奥の霞だけ → 1=全表示）。JS 非駆動時は CSS 既定の 1（全表示）。
      const reveal = Math.min(1, Math.max(0, (window.scrollY - revealStart) / revealLen))
      el.style.setProperty('--road-reveal', reveal.toFixed(3))
      // 誘導演出の可視度（フェードイン × フェードアウト）。道本体とは独立した
      // 専用要素に書き込む（道側の変数・描画には影響しない）。
      // JS 非駆動時は CSS 既定の 0（非表示）
      if (introRef.current) {
        const appear = Math.min(1, Math.max(0, (window.scrollY - introAppearStart) / introAppearLen))
        const fade = Math.min(1, Math.max(0, (window.scrollY - introFadeStart) / introFadeLen))
        // レイヤー全体はホワイトアウト終盤のフェードインのみ担当
        introRef.current.style.setProperty('--road-intro', appear.toFixed(3))
        // 渡鴉の退場（道リビール前に霞へ消える）
        introRef.current.style.setProperty('--road-out', (1 - fade).toFixed(3))
        // 歩行進行（0→1）。各足跡は自分のしきい値(--step-t)を越えると現れ、
        // 越えたまま留まる＝ループしない一回きりの歩み。戻せば逆再生
        const walk = Math.min(1, Math.max(0, (window.scrollY - walkStart) / walkLen))
        introRef.current.style.setProperty('--road-walk', walk.toFixed(3))
        // 足跡の退場進行。同じしきい値を使うことで手前の一歩から順番に消える
        introRef.current.style.setProperty('--road-walkout', fade.toFixed(3))
        // 道の重なりによる退場進行（奥＝上の足跡から順番に消える）
        const topOut = Math.min(1, Math.max(0, (window.scrollY - topOutStart) / topOutLen))
        introRef.current.style.setProperty('--road-topout', topOut.toFixed(3))
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    const onResize = () => {
      measure()
      onScroll()
    }

    measure()
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const modifiers = `${fadeTop ? ' road-bg--fade-top' : ''}${fadeBottom ? ' road-bg--fade-bottom' : ''}`

  return (
    <>
    <div ref={ref} aria-hidden className={`road-bg${modifiers}`}>
      {/* ビューポート固定のステージ。clip-path でセクション範囲だけ見える */}
      <div className="road-bg__viewport">
        <div className="road-bg__scene">
          {/* 遠近をかけた道平面。テクスチャ（子レイヤー）の background-position を --road-shift で流す */}
          <div className="road-bg__plane">
            <div className="road-bg__road" />
            {/* 両脇の柱。平面上の基準点に立て、道と同じ速度で手前へ流す。
                下部は blur 版とのクロスフェードで道に馴染ませる */}
            {PILLAR_BASES.map((base) =>
              PILLAR_SIDES.map((side) => (
                <div
                  key={`${base}-${side}`}
                  className={`road-bg__pillar road-bg__pillar--${side}`}
                  style={{ '--pillar-base': base } as CSSProperties}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/road-pillar.png"
                    alt=""
                    decoding="async"
                    loading="lazy"
                    className="road-bg__pillar-img road-bg__pillar-img--sharp"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/road-pillar.png"
                    alt=""
                    decoding="async"
                    loading="lazy"
                    className="road-bg__pillar-img road-bg__pillar-img--blur"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/road-pillar.png"
                    alt=""
                    decoding="async"
                    loading="lazy"
                    className="road-bg__pillar-img road-bg__pillar-img--blur-top"
                  />
                </div>
              )),
            )}
          </div>
        </div>
        {/* 上端（地平線まわり）を強くぼかして遠くへ霞ませる */}
        <div className="road-blur road-blur--top" />
        {/* 下端の軽いブラー帯（HA ヒーローの hero-blur 踏襲。手前の被写界深度） */}
        <div className="road-blur" />
      </div>
    </div>
    {/* 道の出現前の誘導演出（渡鴉＋足跡）。.road-bg のクリップ外・ビューポート
        固定の兄弟レイヤーとして描画するため、ホワイトアウト（ヒーロー側）の上にも
        全画面で表示できる。可視度は専用の --road-intro（introRef に直接書き込み）
        で制御し、道本体の変数・描画には一切影響しない */}
    {intro && (
      <div ref={introRef} className="road-intro" aria-hidden>
        {/* 渡鴉は飛行 keyframes が opacity を持つため、退場フェードは外側の
            ホルダー（--road-out）で掛ける */}
        <span className="road-intro__raven-holder">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-raven.png" alt="" decoding="async" loading="lazy" className="road-intro__raven" />
        </span>
        {INTRO_STEPS.map((st) => (
          <span
            key={st.i}
            className={`road-intro__step road-intro__step--${st.side}`}
            style={
              {
                left: st.x,
                top: st.y,
                '--step-scale': st.s,
                '--step-t': st.i / 7,
              } as CSSProperties
            }
          />
        ))}
      </div>
    )}
    </>
  )
}
