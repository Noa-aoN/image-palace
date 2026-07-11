'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { WordItems } from '@/components/features/wordlists/WordItems'
import {
  getWordlist,
  deleteWordlist,
  updateWordlist,
  checkWords,
  type WordCheckIssue,
} from '@/lib/api/wordlists'
import type { Wordlist } from '@/types/wordlist'

export default function WordlistDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [wordlist, setWordlist] = useState<Wordlist | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 編集モード（並び替え・削除・追加・リスト名の変更）。保存するまで元の内容は変えない。
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftWords, setDraftWords] = useState<string[]>([])
  const [newWord, setNewWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [issues, setIssues] = useState<Map<string, WordCheckIssue> | null>(null)
  const [additions, setAdditions] = useState<string[]>([])

  useEffect(() => {
    getWordlist(params.id)
      .then(setWordlist)
      .catch(() => setError('ワードリストが見つかりませんでした'))
  }, [params.id])

  const startEditing = () => {
    if (!wordlist) return
    setDraftName(wordlist.name)
    setDraftWords(wordlist.words)
    setIssues(null)
    setAdditions([])
    setError(null)
    setEditing(true)
  }

  // 単語を編集・並び替えしても指摘は出したままにする。
  // リストから消えた単語（置換・削除で対応済み）の指摘だけを落とす。
  const updateDraftWords = (next: string[]) => {
    setDraftWords(next)
    setIssues((current) =>
      current ? new Map([...current].filter(([word]) => next.includes(word))) : current
    )
  }

  const addWord = (word: string) => {
    const value = word.trim()
    if (!value) return
    setDraftWords((current) => (current.includes(value) ? current : [...current, value]))
    setAdditions((current) => current.filter((w) => w !== value))
  }

  const handleCheck = async () => {
    if (draftWords.length === 0) return
    setChecking(true)
    setError(null)
    try {
      const result = await checkWords(draftName.trim(), draftWords)
      setIssues(new Map(result.issues.map((issue) => [issue.word, issue])))
      setAdditions(result.additions)
    } catch {
      setError('単語の点検に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setChecking(false)
    }
  }

  const handleSave = async () => {
    if (draftWords.length === 0) {
      setError('単語を1つ以上にしてください')
      return
    }
    if (!draftName.trim()) {
      setError('リスト名を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateWordlist(params.id, { name: draftName.trim(), words: draftWords })
      setWordlist(updated)
      setEditing(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteWordlist(params.id)
      router.push('/wordlists')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
    }
  }

  if (error && !wordlist) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!wordlist) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="h-7 w-40 rounded bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Breadcrumb items={[{ href: '/wordlists', label: 'ワードリスト' }, { label: wordlist.name }]} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="リスト名" disabled={saving} />
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{wordlist.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{wordlist.word_count} 語</p>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={startEditing} className="flex items-center gap-1.5">
              <Pencil size={14} />
              編集
            </Button>
            {confirming ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>キャンセル</Button>
                <Button size="sm" onClick={handleDelete} disabled={deleting} style={{ backgroundColor: 'var(--destructive)', color: '#fff' }}>
                  {deleting ? '削除中...' : '削除する'}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>削除</Button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!editing && (
        <Link href={`/items/new?wordlist=${wordlist.id}`} className="mt-5 block">
          <Button className="w-full sm:w-auto flex items-center gap-1.5">
            <Sparkles size={16} />
            このワードリストでカードを作成
          </Button>
        </Link>
      )}

      {editing ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">単語（{draftWords.length}）</p>
            <Button
              type="button"
              variant="outline"
              onClick={handleCheck}
              disabled={checking || saving || draftWords.length === 0}
              className="flex items-center gap-1.5"
            >
              {checking ? <Spinner size={14} /> : <ShieldCheck size={15} />}
              {checking ? 'チェック中...' : 'AIチェック'}
            </Button>
          </div>

          <WordItems words={draftWords} onChange={updateDraftWords} issues={issues ?? undefined} disabled={saving} />

          <p className="text-xs text-muted-foreground">ドラッグ、または ↑↓ で並び替えられます。</p>

          {issues !== null && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">AIチェックの結果</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {issues.size === 0
                  ? '未対応の指摘はありません。'
                  : `${issues.size}件の指摘があります（未対応のあいだ表示し続けます）。上のリストで置き換え・削除できます。`}
              </p>

              {additions.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">追加の提案（{additions.length}）</p>
                    <button
                      type="button"
                      onClick={() => additions.forEach(addWord)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      すべて追加
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {additions.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => addWord(word)}
                        className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Plus size={12} />
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                // IME の変換確定の Enter では追加しない（日本語入力で1回目の Enter は確定のため）。
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  addWord(newWord)
                  setNewWord('')
                }
              }}
              placeholder="単語を追加"
              disabled={saving}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                addWord(newWord)
                setNewWord('')
              }}
              disabled={saving}
              className="flex items-center gap-1"
            >
              <Plus size={16} />
              追加
            </Button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存する'}</Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <ol className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {wordlist.words.map((word, i) => (
            <li key={`${word}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span>{word}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
