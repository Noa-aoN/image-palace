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

type RoadBackgroundProps = {
  /** 最初のセクション用: 上端（ヒーローとの境界）で道をフェードインさせる */
  fadeTop?: boolean
  /** 最後のセクション用: 下端（フッターとの境界）で道をフェードアウトさせる */
  fadeBottom?: boolean
}

export function RoadBackground({ fadeTop, fadeBottom }: RoadBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // 初回リビールの基準点: ヒーロー終端（sticky が解けて道が見え始める scrollY）。
    // 全インスタンスが同じ値を参照することで固定ステージの同期が保たれる。
    // ページ高の 0.7 倍分のスクロールで奥→手前へ道が伸びきる。
    let revealStart = 0
    let revealLen = 1
    const measure = () => {
      const hero = document.querySelector<HTMLElement>('.hero-track')
      const ih = window.innerHeight
      revealStart = hero ? hero.offsetTop + hero.offsetHeight - ih : 0
      revealLen = ih * 0.7
    }

    let raf = 0
    const update = () => {
      raf = 0
      // 下へスクロール＝道が手前(下)へ流れる＝前進。repeat-y が自動で折り返す。
      el.style.setProperty('--road-shift', (window.scrollY * SPEED).toFixed(1))
      // 初回リビール（0=奥の霞だけ → 1=全表示）。JS 非駆動時は CSS 既定の 1（全表示）。
      const reveal = Math.min(1, Math.max(0, (window.scrollY - revealStart) / revealLen))
      el.style.setProperty('--road-reveal', reveal.toFixed(3))
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
  )
}
