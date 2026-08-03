'use client'

import { useEffect, useState } from 'react'
import { Plus, Send, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createAdminPost,
  deleteAdminPost,
  deliverAdminPost,
  getAdminPosts,
  updateAdminPost,
} from '@/lib/api/posts'
import { POST_CATEGORIES, POST_CATEGORY_LABELS, type AdminPost, type PostCategory } from '@/types/post'

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

/**
 * 運営からの読みもの（お知らせ・更新情報・コラム）の管理。
 *
 * 本文は平文で書く。見出しは「## 」、箇条書きは「- 」、引用は「> 」だけを約束事にする。
 * 書く側に構造化を強いると続かないため。
 *
 * 配信は取り返しがつかない（人数分のお知らせが積まれる）ので、確認を挟む。
 */
export function AdminPostsPanel() {
  const [posts, setPosts] = useState<AdminPost[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ id: string; action: 'deliver' | 'delete' } | null>(null)

  const load = async () => {
    try {
      setPosts(await getAdminPosts())
    } catch {
      setError('一覧を取得できませんでした')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startNew = () => {
    setEditingId(null)
    setDraft(EMPTY)
    setError(null)
  }

  const startEdit = (post: AdminPost) => {
    setEditingId(post.id)
    setError(null)
    setDraft({
      slug: post.slug,
      category: post.category,
      title: post.title,
      excerpt: post.excerpt ?? '',
      body_text: post.body_text,
      tags: post.tags.join(', '),
      pinned: post.pinned,
      published: post.published,
    })
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const input = {
      slug: draft.slug.trim(),
      category: draft.category,
      title: draft.title.trim(),
      excerpt: draft.excerpt.trim(),
      body_text: draft.body_text,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      pinned: draft.pinned,
      published: draft.published,
    }
    try {
      if (editingId) await updateAdminPost(editingId, input)
      else await createAdminPost(input)
      await load()
      startNew()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: string[]; error?: string } } }
      setError(e?.response?.data?.errors?.join(' / ') ?? e?.response?.data?.error ?? '保存できませんでした')
    } finally {
      setBusy(false)
    }
  }

  const runConfirmed = async (post: AdminPost, action: 'deliver' | 'delete') => {
    setBusy(true)
    setError(null)
    try {
      if (action === 'deliver') await deliverAdminPost(post.id)
      else await deleteAdminPost(post.id)
      await load()
      setConfirming(null)
      if (action === 'delete' && editingId === post.id) startNew()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? '実行できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">読みもの（お知らせ・更新情報・コラム）</h2>
        <Button size="sm" variant="outline" onClick={startNew} className="flex items-center gap-1.5">
          <Plus size={15} />
          新規
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">{editingId ? '編集' : '新規作成'}</p>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="post-title" className="mb-1 block text-xs text-muted-foreground">タイトル</label>
            <Input
              id="post-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="post-category" className="mb-1 block text-xs text-muted-foreground">種類</label>
            <select
              id="post-category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as PostCategory })}
              disabled={busy}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              {POST_CATEGORIES.map((c) => (
                <option key={c} value={c}>{POST_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="post-slug" className="mb-1 block text-xs text-muted-foreground">
              URL（半角英数とハイフン）
            </label>
            <Input
              id="post-slug"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="release-2026-08"
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="post-tags" className="mb-1 block text-xs text-muted-foreground">
              タグ（カンマ区切り）
            </label>
            <Input
              id="post-tags"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              disabled={busy}
            />
          </div>
        </div>

        <div>
          <label htmlFor="post-excerpt" className="mb-1 block text-xs text-muted-foreground">要約（一覧に出る一文）</label>
          <Input
            id="post-excerpt"
            value={draft.excerpt}
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            disabled={busy}
          />
        </div>

        <div>
          <label htmlFor="post-body" className="mb-1 block text-xs text-muted-foreground">
            本文（「## 」で見出し、「- 」で箇条書き、「&gt; 」で引用）
          </label>
          <textarea
            id="post-body"
            value={draft.body_text}
            onChange={(e) => setDraft({ ...draft, body_text: e.target.value })}
            rows={10}
            disabled={busy}
            className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              disabled={busy}
            />
            公開する
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
              disabled={busy}
            />
            先頭に留める
          </label>
          <Button onClick={save} disabled={busy || !draft.title.trim() || !draft.slug.trim()}>
            {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
            保存
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {posts === null && <li className="px-3 py-4 text-sm text-muted-foreground">読み込み中…</li>}
        {posts?.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">まだありません。</li>}
        {posts?.map((post) => (
          <li key={post.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="rounded-full border border-border px-2 py-0.5 text-xs">{post.category_label}</span>
            <button type="button" onClick={() => startEdit(post)} className="flex-1 truncate text-left hover:underline">
              {post.title}
            </button>
            <span className="text-xs text-muted-foreground">
              {post.published ? '公開中' : '下書き'}
              {post.delivered_at && ' / 配信済み'}
            </span>

            {post.published && !post.delivered_at && (
              <Button
                size="sm"
                variant={confirming?.id === post.id && confirming.action === 'deliver' ? 'destructive' : 'outline'}
                disabled={busy}
                onClick={() => {
                  if (confirming?.id === post.id && confirming.action === 'deliver') runConfirmed(post, 'deliver')
                  else setConfirming({ id: post.id, action: 'deliver' })
                }}
                onBlur={() => setConfirming(null)}
                className="flex items-center gap-1"
              >
                <Send size={13} />
                {confirming?.id === post.id && confirming.action === 'deliver' ? '全員に配信（確定）' : '配信'}
              </Button>
            )}

            <Button
              size="sm"
              variant={confirming?.id === post.id && confirming.action === 'delete' ? 'destructive' : 'ghost'}
              disabled={busy}
              onClick={() => {
                if (confirming?.id === post.id && confirming.action === 'delete') runConfirmed(post, 'delete')
                else setConfirming({ id: post.id, action: 'delete' })
              }}
              onBlur={() => setConfirming(null)}
              aria-label={`${post.title}を削除`}
            >
              <Trash2 size={13} />
              {confirming?.id === post.id && confirming.action === 'delete' && '本当に削除'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
