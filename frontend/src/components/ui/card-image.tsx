'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// カードの「マット」。余白は画像の短辺に対して控えめに取り、内側に細い枠線を入れる。
// トレーディングカードの厚紙の縁を意識した見え方にしている。
// 台紙は周囲より少し明るく／内側に落ち影を入れて、画像が「載っている」ように見せる。
// 画像側の細い縁と合わせて、背景色が同じ場所でもマットが判別できる。
const CARD_FRAME = 'p-[5%] bg-[color-mix(in_srgb,var(--card)_92%,var(--foreground))] rounded-[inherit]'

// 画像読み込み中は LQIP（blur）を背景に表示し、読み込み完了で本画像をフェードイン。
// src が無い場合は fallback を中央表示する。
//
// framed: トレーディングカードのように、画像の周りへ細い余白（マット）を入れる。
// 余白と角丸をここに集約しているので、将来スキンやフレームを差し替えるときは
// この一箇所を変えれば全画面に効く。
export function CardImage({
  src,
  blur,
  alt,
  fallback,
  className,
  imgClassName,
  framed = false,
}: {
  src: string | null | undefined
  blur?: string
  alt: string
  fallback?: ReactNode
  className?: string
  imgClassName?: string
  framed?: boolean
}) {
  const [loaded, setLoaded] = useState(false)

  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', framed && CARD_FRAME, className)}>
        {fallback}
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden bg-muted', framed && CARD_FRAME, className)}>
      <div
        className={cn(
          'relative h-full w-full overflow-hidden',
          framed && 'rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.25)] ring-1 ring-black/15'
        )}
        style={
          blur ? { backgroundImage: `url("${blur}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
        }
      >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-500',
          framed && 'rounded-[2px]',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName
        )}
      />
      </div>
    </div>
  )
}
