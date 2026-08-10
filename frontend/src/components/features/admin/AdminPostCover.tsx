'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { removeAdminPostCover, uploadAdminPostCover } from '@/lib/api/posts'
import type { AdminPost } from '@/types/post'

/**
 * 読みものの見出し画像。
 *
 * 保存を待たずにその場で差し替える。本文の保存と一緒にすると、
 * 画像を選んだのに保存を押し忘れて反映されない、が起きる。
 *
 * 「出す／出さない」は添付とは別に持つ。短い連絡では絵を出したくないことがあり、
 * そのたびに画像を消して入れ直すのは手間なので。
 */
export function AdminPostCover({
  post,
  visible,
  onVisibleChange,
  onChanged,
}: {
  post: AdminPost
  visible: boolean
  onVisibleChange: (next: boolean) => void
  onChanged: (next: AdminPost) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      onChanged(await uploadAdminPostCover(post.id, file))
    } catch (e) {
      const detail = (e as { response?: { data?: { error?: string } } })?.response?.data
      setError(detail?.error ?? '差し替えられませんでした。')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      onChanged(await removeAdminPostCover(post.id))
    } catch {
      setError('外せませんでした。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2">
      <p className="text-sm font-medium">見出し画像</p>

      <div className="flex flex-wrap items-center gap-3">
        {post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 外部CDNの画像。最適化は経由させない
          <img
            src={post.image_url}
            alt=""
            className={`h-20 w-32 rounded-lg border border-border object-cover ${visible ? '' : 'opacity-40'}`}
          />
        ) : (
          <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            なし
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5"
            >
              {busy ? <Spinner size={13} /> : <ImagePlus size={14} />}
              {post.image_url ? '差し替える' : '選ぶ'}
            </Button>
            {post.image_url && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={remove}
                className="flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                外す
              </Button>
            )}
          </div>

          {post.image_url && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={visible} onChange={(e) => onVisibleChange(e.target.checked)} />
              一覧と記事に出す
            </label>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
        }}
      />

      <p className="text-xs text-muted-foreground">
        PNG / JPEG / WebP（10MB まで）。保存すると WebP に変換し、一覧用の小さい版も作ります。
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
