'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { createAdminPost, getAdminPost, updateAdminPost } from '@/lib/api/posts'
import { POST_CATEGORIES, POST_CATEGORY_LABELS, type AdminPost, type PostCategory } from '@/types/post'

type Draft = {
  slug: string
  category: PostCategory
  title: string
  excerpt: string
  body_text: string
  tags: string
  pinned: boolean
  published: boolean
}

const EMPTY: Draft = {
  slug: '',
  category: 'news',
  title: '',
  excerpt: '',
  body_text: '',
  tags: '',
  pinned: false,
  published: false,
}

/**
 * 読みものを書く画面。
 *
 * 一覧から分けて1本ぶんの専用ページにしてある。文章を書く作業に、
 * 一覧の表と削除ボタンが並んでいる必要はない。
 *
 * 本文は平文で書く。見出しは「## 」、箇条書きは「- 」、引用は「> 」だけを
 * 約束事にしている。書く側に構造化を強いると続かない。
 */
export function AdminPostEditor({ postId }: { postId?: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [post, setPost] = useState<AdminPost | null>(null)
  const [loading, setLoading] = useState(Boolean(postId))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!postId) return
    getAdminPost(postId)
      .then((loaded) => {
        setPost(loaded)
        setDraft({
          slug: loaded.slug,
          category: loaded.category,
          title: loaded.title,
          excerpt: loaded.excerpt ?? '',
          body_text: loaded.body_text,
          tags: loaded.tags.join(', '),
          pinned: loaded.pinned,
          published: loaded.published,
        })
      })
      .catch(() => setError('読み込めませんでした。'))
      .finally(() => setLoading(false))
  }, [postId])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    const input = {
      slug: draft.slug.trim(),
      category: draft.category,
      title: draft.title.trim(),
      excerpt: draft.excerpt.trim() || undefined,
      body_text: draft.body_text,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      pinned: draft.pinned,
      published: draft.published,
    }
    try {
      if (postId) {
        setPost(await updateAdminPost(postId, input))
        setSaved(true)
      } else {
        const created = await createAdminPost(input)
        // 作ったあとは編集ページへ。一覧へ戻すと、続けて直したいときに探し直しになる
        router.replace(`/admin/posts/${created.id}`)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  const field = (name: 'slug' | 'title' | 'excerpt' | 'tags', label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`post-${name}`}>{label}</Label>
      <Input
        id={`post-${name}`}
        value={draft[name]}
        onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/posts" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} />
          読みもの一覧へ
        </Link>
        {post?.published && (
          <a
            href={`/${post.category === 'column' ? 'blog' : 'news'}/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Eye size={14} />
            公開ページを見る
          </a>
        )}
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {field('title', '題名')}
          {field('slug', 'URL の名前', 'spring-update')}
          <div className="space-y-1">
            <Label htmlFor="post-category">種類</Label>
            <select
              id="post-category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as PostCategory })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {POST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {POST_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          {field('tags', 'タグ（カンマ区切り）')}
        </div>

        {field('excerpt', '一覧に出す要約')}

        <div className="space-y-1">
          <Label htmlFor="post-body">本文</Label>
          <textarea
            id="post-body"
            value={draft.body_text}
            onChange={(e) => setDraft({ ...draft, body_text: e.target.value })}
            rows={18}
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
            placeholder={'ふつうの段落はそのまま書きます。\n\n## 見出し\n- 箇条書き\n> 引用'}
          />
          <p className="text-xs text-muted-foreground">
            見出しは <code>## </code>、箇条書きは <code>- </code>、引用は <code>&gt; </code>。空行が段落の切れ目です。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            公開する
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
            />
            先頭に留める
          </label>
          <div className="ml-auto flex items-center gap-2">
            {saved && <span className="text-sm text-muted-foreground">保存しました</span>}
            <Button onClick={save} disabled={saving || !draft.title.trim() || !draft.slug.trim()}>
              {saving ? <Spinner size={14} /> : <Check size={14} />}
              保存
            </Button>
          </div>
        </div>

        {post && (
          <p className="text-xs text-muted-foreground">
            読まれた回数 {post.views_count.toLocaleString()}
            {post.delivered_at && ' / 配信済み'}
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  )
}

function errorMessage(e: unknown): string {
  const detail = (e as { response?: { data?: { error?: string; errors?: string[] } } })?.response?.data
  return detail?.error || detail?.errors?.join('・') || '保存できませんでした。'
}
