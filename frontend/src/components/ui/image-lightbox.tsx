'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Download, X } from 'lucide-react'

/**
 * 画像を大きく見るための覆い。
 *
 * カード詳細の拡大表示にあった作りを、どの画像からでも使えるように切り出したもの。
 * **新しい依存は足していない**（覆いと `<img>` だけで足りる）。
 *
 * 閉じ方を3つ用意する。どれか1つでも欠けると、閉じられない人が出る。
 *   - 背景を押す（指で使う人の自然な動き）
 *   - Esc（鍵盤で使う人）
 *   - 右上の×（押す場所が要る人・触る画面で確実な出口）
 *
 * 開いている間は、背後の一覧を触れないようにする（`aria-modal` と、
 * 覆いへ焦点を移すこと）。背後が触れると、閉じたつもりで別のものを押してしまう。
 */
export function ImageLightbox({
  url,
  alt,
  open,
  onClose,
  onDownload,
}: {
  url: string | null | undefined
  /** 読み上げと、画像が出ないときの代わりの文。**空にしない** */
  alt: string
  open: boolean
  onClose: () => void
  /** 渡したときだけ、ダウンロードの釦を出す */
  onDownload?: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  // 閉じたあと、元いた場所へ焦点を戻すために覚えておく
  const openerRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    onClose()
    // 開く前に触っていたものへ戻す。戻さないと、鍵盤の位置が先頭へ飛ぶ
    openerRef.current?.focus?.()
  }, [onClose])

  useEffect(() => {
    if (!open) return

    openerRef.current = document.activeElement as HTMLElement | null
    overlayRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    // 背後が動くと、閉じたときに見ていた場所を見失う
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

  if (!open || !url) return null

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4 outline-none"
      onClick={close}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        {onDownload && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDownload()
            }}
            aria-label="画像をダウンロード"
            title="画像をダウンロード"
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm text-white transition-colors hover:bg-white/25"
          >
            <Download size={16} />
            ダウンロード
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
          aria-label="閉じる"
          className="rounded-lg bg-white/15 p-2 text-white transition-colors hover:bg-white/25"
        >
          <X size={16} />
        </button>
      </div>

      {/* 縦横の比は変えない。切り取ると、確かめたくて開いた人の目的を外す */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 生成画像は CDN 配信。最適化を経由させない */}
      <img
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full cursor-default rounded-xl object-contain"
      />
    </div>
  )
}

/**
 * 画像を「押したら開く」ようにする釦。
 *
 * `<img>` に onClick を付けるだけだと、鍵盤では押せない。
 * 押せるものは押せると分かる形（button）にして、読み上げにも名前を渡す。
 */
export function ZoomableImage({
  url,
  alt,
  onOpen,
  className,
  children,
}: {
  url: string | null | undefined
  alt: string
  onOpen: () => void
  className?: string
  children: React.ReactNode
}) {
  if (!url) return <>{children}</>

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${alt}を大きく見る`}
      className={`cursor-zoom-in rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)] ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
