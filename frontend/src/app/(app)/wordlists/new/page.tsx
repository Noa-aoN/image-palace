'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { generateWords, createWordlist } from '@/lib/api/wordlists'

export default function NewWordlistPage() {
  const router = useRouter()
  const [theme, setTheme] = useState('')
  const [count, setCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [words, setWords] = useState<string[] | null>(null)
  const [name, setName] = useState('')
  const [newWord, setNewWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const generated = await generateWords(theme.trim(), count)
      setWords(generated)
      if (!name.trim()) setName(theme.trim())
    } catch {
      setError('単語の生成に失敗しました。テーマを変えて再度お試しください。')
    } finally {
      setGenerating(false)
    }
  }

  const removeWord = (target: number) =>
    setWords((current) => (current ? current.filter((_, i) => i !== target) : current))

  const addWord = () => {
    const word = newWord.trim()
    if (!word) return
    setWords((current) => {
      if (!current) return [word]
      return current.includes(word) ? current : [...current, word]
    })
    setNewWord('')
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/wordlists">
          <Button variant="ghost" className="text-sm px-0 mb-4">← ワードリストへ戻る</Button>
        </Link>
        <h1 className="text-2xl font-semibold">ワードリストを作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          テーマと単語数を指定するとAIが単語を生成します。編集してから保存できます。
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
        <div className="w-24">
          <label htmlFor="count" className="mb-1 block text-sm font-medium">単語数</label>
          <Input
            id="count"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            disabled={generating}
          />
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="flex items-center justify-center gap-2 sm:w-28">
          {generating ? <Spinner size={15} /> : <Sparkles size={16} />}
          {generating ? '生成中...' : '生成'}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* 生成結果（編集可能） */}
      {words && (
        <div className="mt-8 space-y-5">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">リスト名</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="リスト名" disabled={saving} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">単語（{words.length}）</p>
            <div className="flex flex-wrap gap-2">
              {words.map((word, i) => (
                <span
                  key={`${word}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm"
                >
                  {word}
                  <button
                    type="button"
                    onClick={() => removeWord(i)}
                    aria-label={`${word}を削除`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addWord()
                  }
                }}
                placeholder="単語を追加"
                disabled={saving}
              />
              <Button type="button" variant="outline" onClick={addWord} disabled={saving} className="flex items-center gap-1">
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
