'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Newspaper, Plus, Send, Trash2, Pin, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getAdminPosts, deleteAdminPost, deliverAdminPost, updateAdminPost } from '@/lib/api/posts'
import { POST_CATEGORIES, POST_CATEGORY_LABELS, type AdminPost, type PostCategory } from '@/types/post'
import { useCanOperate } from '@/hooks/useAdminPermissions'
import { ReadOnlyNotice } from '@/components/features/admin/ReadOnlyNotice'

/**
 * 読みものの一覧。
 *
 * 書くのは別ページに分けてある。一覧の中に編集欄があると、
 * 「いま何本あって、どれが公開されているか」を見に来ただけのときに邪魔になる。
 * 一覧でやるのは**状態を見ることと、状態を変えること**だけ。
 *
 * 配信は取り返しがつかない（人数分のお知らせが積まれる）ので、2度押しで確定させる。
 */
export function AdminPostsList() {
  const canWrite = useCanOperate()
  const [posts, setPosts] = useState<AdminPost[] | null>(null)
  const [category, setCategory] = useState<PostCategory | 'all'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ id: string; action: 'deliver' | 'delete' } | null>(null)

  useEffect(() => {
    getAdminPosts()
      .then(setPosts)
      .catch(() => setError('一覧を取得できませんでした。'))
  }, [])

  const replace = (updated: AdminPost) =>
    setPosts((rows) => (rows ? rows.map((p) => (p.id === updated.id ? updated : p)) : rows))

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
      setConfirming(null)
    }
  }

  const togglePublish = (post: AdminPost) =>
    act(post.id, async () => replace(await updateAdminPost(post.id, { published: !post.published })))

  const togglePin = (post: AdminPost) =>
    act(post.id, async () => replace(await updateAdminPost(post.id, { pinned: !post.pinned })))

  const deliver = (post: AdminPost) => {
    if (confirming?.id !== post.id || confirming.action !== 'deliver') {
      setConfirming({ id: post.id, action: 'deliver' })
      return
    }
    act(post.id, async () => replace(await deliverAdminPost(post.id)))
  }

  const remove = (post: AdminPost) => {
    if (confirming?.id !== post.id || confirming.action !== 'delete') {
      setConfirming({ id: post.id, action: 'delete' })
      return
    }
    act(post.id, async () => {
      await deleteAdminPost(post.id)
      setPosts((rows) => (rows ? rows.filter((p) => p.id !== post.id) : rows))
    })
  }

  const rows = (posts ?? []).filter((p) => category === 'all' || p.category === category)

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-lg font-semibold">読みもの</h2>
        </div>
        {/* 行き先そのものは fieldset で止まらない（Link は入力部品ではない）。
            出さないことで止める */}
        {canWrite && (
          <Link href="/admin/posts/new">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus size={14} />
              新しく書く
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={category === 'all'} onClick={() => setCategory('all')}>
          すべて
        </Chip>
        {POST_CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {POST_CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      {!canWrite && <ReadOnlyNotice what="読みものの作成・配信" />}

      {/* 絞り込み（種類の切替）は止めない。見るだけの人も行き来できるようにする */}
      <fieldset disabled={!canWrite} className="contents">

      {posts === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} /> 読み込み中…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[50rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">題名</th>
                <th className="py-2 pr-3">種類</th>
                <th className="py-2 pr-3">状態</th>
                <th className="py-2 pr-3 text-right">読まれた回数</th>
                <th className="py-2 pr-3">配信</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((post) => (
                <tr key={post.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/posts/${post.id}`} className="font-medium hover:text-[var(--palace)]">
                      {post.pinned && <Pin size={12} className="mr-1 inline" />}
                      {post.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{post.slug}</div>
                  </td>
                  <td className="py-2 pr-3">{post.category_label}</td>
                  <td className="py-2 pr-3">
                    <StatusLabel post={post} />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Eye size={12} className="text-muted-foreground" />
                      {post.views_count.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {post.delivered_at ? '配信済み' : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePublish(post)}
                        disabled={busy === post.id}
                        className="text-xs"
                      >
                        {post.published ? '非公開にする' : '公開する'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePin(post)}
                        disabled={busy === post.id}
                        aria-label={post.pinned ? '留めを外す' : '先頭に留める'}
                        title={post.pinned ? '留めを外す' : '先頭に留める'}
                      >
                        <Pin size={14} />
                      </Button>
                      {post.published && !post.delivered_at && (
                        <Button
                          variant={confirming?.id === post.id && confirming.action === 'deliver' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => deliver(post)}
                          disabled={busy === post.id}
                          onBlur={() => setConfirming(null)}
                          className="flex items-center gap-1 text-xs"
                        >
                          <Send size={13} />
                          {confirming?.id === post.id && confirming.action === 'deliver' ? '本当に配信' : '配信'}
                        </Button>
                      )}
                      <Button
                        variant={confirming?.id === post.id && confirming.action === 'delete' ? 'destructive' : 'ghost'}
                        size="sm"
                        onClick={() => remove(post)}
                        disabled={busy === post.id}
                        onBlur={() => setConfirming(null)}
                        aria-label="削除"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      </fieldset>
    </section>
  )
}

// 予約は published が false になるので、そのままだと下書きと見分けが付かない
function StatusLabel({ post }: { post: AdminPost }) {
  if (post.status === 'published') return <span style={{ color: 'var(--palace)' }}>公開</span>
  if (post.status === 'scheduled') {
    return (
      <span className="text-muted-foreground">
        予約（{new Date(post.published_at!).toLocaleDateString('ja-JP')}）
      </span>
    )
  }
  return <span className="text-muted-foreground">下書き</span>
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
      }`}
      style={active ? { backgroundColor: 'var(--palace)' } : undefined}
    >
      {children}
    </button>
  )
}

function errorMessage(e: unknown): string {
  const detail = (e as { response?: { data?: { error?: string; errors?: string[] } } })?.response?.data
  return detail?.error || detail?.errors?.join('・') || '操作できませんでした。'
}
