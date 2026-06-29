'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// 画像読み込み中は LQIP（blur）を背景に表示し、読み込み完了で本画像をフェードイン。
// src が無い場合は fallback を中央表示する。
export function CardImage({
  src,
  blur,
  alt,
  fallback,
  className,
  imgClassName,
}: {
  src: string | null | undefined
  blur?: string
  alt: string
  fallback?: ReactNode
  className?: string
  imgClassName?: string
}) {
  const [loaded, setLoaded] = useState(false)

  if (!src) {
    return <div className={cn('flex items-center justify-center bg-muted', className)}>{fallback}</div>
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-muted', className)}
      style={blur ? { backgroundImage: `url("${blur}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
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
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName
        )}
      />
    </div>
  )
}
