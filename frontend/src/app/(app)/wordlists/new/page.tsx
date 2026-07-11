'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { WordItems } from '@/components/features/wordlists/WordItems'
import { generateWords, createWordlist, checkWords, type WordCheckIssue } from '@/lib/api/wordlists'

export default function NewWordlistPage() {
  const router = useRouter()
  const [theme, setTheme] = useState('')
  const [count, setCount] = useState(10)
  // 単語数は既定で「おまかせ」。テーマに応じた自然な数（十二支なら12個など）をAIが決める。
  const [auto, setAuto] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [words, setWords] = useState<string[] | null>(null)
  const [name, setName] = useState('')
  const [newWord, setNewWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // AIチェックの結果。単語を編集・並び替え・再生成したら破棄する（古い判定を残さない）。
  const [checking, setChecking] = useState(false)
  const [issues, setIssues] = useState<Map<string, WordCheckIssue> | null>(null)
  const [additions, setAdditions] = useState<string[]>([])

  const clearCheck = () => {
    setIssues(null)
    setAdditions([])
  }

  const updateWords = (next: string[]) => {
    setWords(next)
    clearCheck()
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    clearCheck()
    try {
      const generated = await generateWords(theme.trim(), auto ? undefined : count)
      setWords(generated)
      if (!name.trim()) setName(theme.trim())
    } catch {
      setError('単語の生成に失敗しました。テーマを変えて再度お試しください。')
    } finally {
      setGenerating(false)
    }
  }

  // テーマ（未入力ならリスト名）に沿っているかを点検する。適用は一件ずつユーザーが承認する。
  const handleCheck = async () => {
    if (!words || words.length === 0) return
    setChecking(true)
    setError(null)
    try {
      const result = await checkWords(theme.trim() || name.trim(), words)
      setIssues(new Map(result.issues.map((issue) => [issue.word, issue])))
      setAdditions(result.additions)
    } catch {
      setError('単語の点検に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setChecking(false)
    }
  }

  const addWord = (word: string) => {
    const value = word.trim()
    if (!value) return
    setWords((current) => {
      if (!current) return [value]
      return current.includes(value) ? current : [...current, value]
    })
    setAdditions((current) => current.filter((w) => w !== value))
  }

  const handleSave = async () => {
    if (!words || words.length === 0) {
      setError('単語を1つ以上にしてください')
      return
    }
    if (!name.trim()) {
      setError('リスト名を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createWordlist(name.trim(), words)
      router.push('/wordlists')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? 'ワードリストの保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const checked = issues !== null

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Breadcrumb items={[{ href: '/wordlists', label: 'ワードリスト' }, { label: '作成' }]} />
        <h1 className="text-2xl font-semibold">ワードリストを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          テーマを入れるとAIが単語を生成します。単語数はおまかせ（テーマに応じてAIが決める）が既定です。
          並び替え・編集して、AIチェックで内容を確かめてから保存できます。
        </p>
      </div>

      {/* 生成フォーム */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="theme" className="mb-1 block text-sm font-medium">テーマ（空欄でランダム）</label>
          <Input
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例: 英語の動物、Rails用語"
            disabled={generating}
          />
        </div>
        <div className="w-28">
          <label htmlFor="count" className="mb-1 block text-sm font-medium">単語数</label>
          <Input
            id="count"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            disabled={generating || auto}
          />
          <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              disabled={generating}
              className="h-3.5 w-3.5 rounded border-input"
            />
            おまかせ
          </label>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="flex items-center justify-center gap-2 sm:w-28">
          {generating ? <Spinner size={15} /> : <Sparkles size={16} />}
          {generating ? '生成中...' : '生成'}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* 生成結果（編集・並び替え可能） */}
      {words && (
        <div className="mt-8 space-y-5">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">リスト名</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="リスト名" disabled={saving} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">単語（{words.length}）</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleCheck}
                disabled={checking || saving || words.length === 0}
                className="flex items-center gap-1.5"
              >
                {checking ? <Spinner size={14} /> : <ShieldCheck size={15} />}
                {checking ? 'チェック中...' : 'AIチェック'}
              </Button>
            </div>

            <WordItems words={words} onChange={updateWords} issues={issues ?? undefined} disabled={saving} />

            <p className="mt-2 text-xs text-muted-foreground">
              ドラッグ、または ↑↓ で並び替えられます。
            </p>

            {/* AIチェックの結果 */}
            {checked && (
              <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">AIチェックの結果</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {issues.size === 0
                    ? 'テーマから外れた単語は見つかりませんでした。'
                    : `${issues.size}件の指摘があります。上のリストで置き換え・削除できます。`}
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

            <div className="mt-3 flex gap-2">
              <Input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
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
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存する'}</Button>
            <Button variant="ghost" onClick={handleGenerate} disabled={generating || saving}>再生成</Button>
          </div>
        </div>
      )}
    </div>
  )
}
