'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  EXAMPLE_INTERVAL_MS,
  exampleIndexAt,
  previewFor,
  type AtelierKind,
} from '@/lib/atelier/examples'

// 種別を選ぶ前に、できあがりを見せる小さな窓。
//
// 素材（画像・GIF）が入っていればそれを順ぐりに出す。まだ無いあいだは、
// できあがりの形をかたどった図を出す。**空の枠は出さない。**

const SCHEMATIC_TITLE: Record<AtelierKind, string> = {
  material: '語を並べた素材',
  item: '絵と見出し語のカード',
  view: 'カードを自由に置いたキャンバス',
  space: '記憶の場所に置いたカード',
  box: 'まとめたカードの束',
}

/** 図の共通の色づかい。枠は淡く、中身は宮殿色をうっすら乗せる */
const LINE = 'color-mix(in srgb, var(--palace) 45%, transparent)'
const FILL = 'color-mix(in srgb, var(--palace) 14%, transparent)'
const FAINT = 'color-mix(in srgb, currentColor 16%, transparent)'

function Schematic({ kind }: { kind: AtelierKind }) {
  return (
    <svg
      viewBox="0 0 160 90"
      role="img"
      aria-label={SCHEMATIC_TITLE[kind]}
      className="h-full w-full text-muted-foreground"
      preserveAspectRatio="xMidYMid meet"
    >
      {kind === 'material' && (
        <g stroke={LINE} strokeWidth="1.5" fill="none">
          <rect x="24" y="14" width="112" height="62" rx="4" fill={FILL} />
          {[26, 38, 50, 62].map((y) => (
            <g key={y}>
              <circle cx="36" cy={y} r="2.2" fill={LINE} stroke="none" />
              <line x1="44" y1={y} x2={y === 62 ? 96 : 122} y2={y} strokeLinecap="round" />
            </g>
          ))}
        </g>
      )}

      {kind === 'item' && (
        <g stroke={LINE} strokeWidth="1.5" fill="none">
          <rect x="46" y="8" width="68" height="74" rx="5" fill={FILL} />
          <rect x="53" y="15" width="54" height="40" rx="3" fill={FAINT} />
          <path d="M57 51l12-13 9 9 7-6 17 11" strokeLinejoin="round" />
          <circle cx="66" cy="27" r="3.5" />
          <line x1="53" y1="65" x2="93" y2="65" strokeLinecap="round" strokeWidth="3" />
          <line x1="53" y1="73" x2="79" y2="73" strokeLinecap="round" />
        </g>
      )}

      {kind === 'view' && (
        <g stroke={LINE} strokeWidth="1.5" fill={FILL}>
          <rect x="14" y="12" width="30" height="34" rx="3" />
          <rect x="54" y="26" width="30" height="34" rx="3" />
          <rect x="96" y="8" width="30" height="34" rx="3" />
          <rect x="72" y="66" width="30" height="18" rx="3" />
          <rect x="20" y="58" width="30" height="26" rx="3" />
        </g>
      )}

      {kind === 'space' && (
        <g stroke={LINE} strokeWidth="1.5" fill="none">
          {/* 奥に向かう床。場所として覚えるので、奥行きがあることが要 */}
          <path d="M4 82L44 46h72l40 36" fill={FAINT} />
          <line x1="44" y1="46" x2="4" y2="82" strokeLinecap="round" />
          <line x1="116" y1="46" x2="156" y2="82" strokeLinecap="round" />
          <rect x="44" y="8" width="72" height="38" rx="2" fill={FILL} />
          <rect x="55" y="16" width="22" height="22" rx="2" fill={FAINT} />
          <rect x="86" y="16" width="22" height="22" rx="2" fill={FAINT} />
        </g>
      )}

      {kind === 'box' && (
        <g stroke={LINE} strokeWidth="1.5" fill={FILL}>
          <rect x="34" y="22" width="80" height="54" rx="4" />
          <rect x="42" y="14" width="80" height="54" rx="4" />
          <rect x="50" y="6" width="80" height="54" rx="4" />
          <line x1="50" y1="22" x2="130" y2="22" strokeLinecap="round" fill="none" />
        </g>
      )}
    </svg>
  )
}

export function KindPreview({ kind, label }: { kind: AtelierKind; label: string }) {
  const preview = previewFor(kind)
  const count = preview.mode === 'assets' ? preview.sources.length : 0
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (count < 2) return

    const timer = setInterval(() => setStep((current) => current + 1), EXAMPLE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [count])

  return (
    <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-lg border border-border/70 bg-muted/30">
      {preview.mode === 'schematic' ? (
        <Schematic kind={kind} />
      ) : (
        preview.sources.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt={index === 0 ? `${label}の作例` : ''}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition-opacity duration-700"
            style={{ opacity: index === exampleIndexAt(step, count) ? 1 : 0 }}
          />
        ))
      )}
    </div>
  )
}
