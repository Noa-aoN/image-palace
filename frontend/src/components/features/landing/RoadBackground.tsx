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

// 足跡は周回座標 c（0=最奥 → 1=最手前）で管理するトレッドミル。
// 各足跡は base（0..1 を7等分）だけ位相をずらして道の上に等間隔に並び、
// スクロールで進む --road-walkc が全員の c を進める＝道と一緒に手前へ
// 流れて下端で消え、奥へ回り込んで再び現れるループ。
// 画面上の位置・サイズ・ぼかし・濃さはすべて CSS 側で c から導出する。
// 左右（side）は base 順に交互＝空間上も左右交互の歩みになる
const INTRO_STEPS = [
  { i: 0, side: 'r' },
  { i: 1, side: 'l' },
  { i: 2, side: 'r' },
  { i: 3, side: 'l' },
  { i: 4, side: 'r' },
  { i: 5, side: 'l' },
  { i: 6, side: 'r' },
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
    let dimLen = 1
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
      // 足跡の周回進行（スクロール連動・トレッドミル）。
      // 1周（最奥→最手前）= 1.3 画面分のスクロール。道の地面は 0.6 平面px/
      // スクロールpx で流れる（柱 360px 間隔が 600px ごとに通過）ので、
      // トレイル全長 ≈ 630 平面px ÷ 0.6 ≈ 1050px ≒ 1.3ih と、道と同じ速度感になる
      walkStart = heroEnd - ih * 0.02
      walkLen = ih * 1.3
      // 道の表示が足跡へ十分重なってから、奥（上）の足跡も道に
      // 飲み込まれるように上からゆっくり消していく（手前側の退場より遅い）
      topOutStart = revealStart + ih * 0.3
      topOutLen = ih * 0.4
      // 石畳の表示に伴う全体減光のスクロール長
      dimLen = ih * 0.3
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
        // 周回進行（周数・上限なし）。CSS 側で mod(walkc + base, 1) が
        // 各足跡の周回座標 c になる。戻せば逆流
        const walkC = Math.max(0, (window.scrollY - walkStart) / walkLen)
        introRef.current.style.setProperty('--road-walkc', walkC.toFixed(4))
        // 足跡の退場進行。同じしきい値を使うことで手前の一歩から順番に消える
        introRef.current.style.setProperty('--road-walkout', fade.toFixed(3))
        // 道の重なりによる退場進行（奥＝上の足跡から順番に消える）
        const topOut = Math.min(1, Math.max(0, (window.scrollY - topOutStart) / topOutLen))
        introRef.current.style.setProperty('--road-topout', topOut.toFixed(3))
        // 石畳が表示され始めたら足跡全体をさらに淡くする（1 → 0.55）
        const dim = 1 - 0.45 * Math.min(1, Math.max(0, (window.scrollY - revealStart) / dimLen))
        introRef.current.style.setProperty('--road-dim', dim.toFixed(3))
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
            style={{ '--step-base': st.i / 7 } as CSSProperties}
          />
        ))}
      </div>
    )}
    </>
  )
}
