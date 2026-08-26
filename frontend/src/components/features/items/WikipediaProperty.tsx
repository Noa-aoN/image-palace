'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  fetchWikipediaSummary,
  searchWikipediaCandidates,
  type WikipediaCandidate,
} from '@/lib/api/wikipedia'
import { hasMoreBelow } from '@/lib/scroll-affordance'
import { shouldAutoLookup } from '@/lib/wikipedia-auto-lookup'
import { MAX_TERM_LENGTH, canLookup, resolveLookupTerm } from '@/lib/wikipedia-term'
import type { WikipediaValue } from '@/lib/api/properties'

/** 下端をぼかす幅。ちょうど1行ぶんにして、隠れているのが「次の行」だと分かるようにする */
const FADE = 'linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)'

/**
 * Wikipedia で調べた結果。
 *
 * ここは**読む場所ではなく、確かめて記事へ渡す場所**。だから冒頭までしか出さない。
 * 記事の全文は取りにも行かないし、保存もしない。
 *
 * 出典は必ず添える。Wikipedia の文は CC BY-SA なので、
 * どこから来たのかと、その条件が読めない形で出してはいけない。
 *
 * 画像は URL を指すだけ。ファイルはこちらに持たない
 * （記事本文とは別のライセンスが付くことがあるため）。
 */
export function WikipediaProperty({
  value,
  term,
  languageCode,
  onSaved,
  editable,
  autoLookup = false,
}: {
  value: WikipediaValue | null
  /** 引く語。既定は見出し語 */
  term: string
  /** 引く言語。渡さなければサーバーが決める（利用者の表示言語 → ブラウザ → ja） */
  languageCode?: string
  onSaved: (next: WikipediaValue) => void
  editable: boolean
  /**
   * 作った直後に、押さずとも調べ始める。
   *
   * 足した瞬間に空の枠が出るだけだと、もう一度「調べる」を押させることになる。
   * Wikipedia は他の項目と違い、押せば中身まで入るのが値打ちなので、
   * そこまで一息で進める。
   *
   * **既に値のあるものには効かない。** カードを開くたびに引き直したら、
   * 手で選んだ記事が黙って別のものに変わる
   */
  autoLookup?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  /**
   * 何で引くか。**見出し語で固定しない。**
   *
   * 見出し語は短い呼び名で置くことが多く（DNS・国連・東大）、そのままだと
   * 目的の記事に当たらないことがある。逆に一般名詞すぎて曖昧さ回避へ落ちることもある。
   *
   * **空欄は「見出し語のまま」。** 見出し語をここへ写して持たないのは、
   * 見出し語をあとから直したときに、こちらが古いまま残るのを避けるため
   */
  const [draft, setDraft] = useState('')
  /** 引き直しのときだけ、語の欄を開く（ふだんは出さない） */
  const [editingTerm, setEditingTerm] = useState(false)
  // 題が一致しなかったときの候補。**選ぶまで保存しない**。
  // 一番上を勝手に採ると、同名の別人・別作品が黙ってカードに入る
  const [candidates, setCandidates] = useState<WikipediaCandidate[] | null>(null)
  const [candidateLanguage, setCandidateLanguage] = useState<string | null>(null)
  // 続きがあるあいだだけ下端をぼかす（読み終わったら消す）
  const [more, setMore] = useState(false)
  // 中身が入った時点でも測る。開いた直後に判定できないと、
  // 一度触るまでぼかしが出ない
  const extractRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setMore(hasMoreBelow(node))
  }, [])

  // 近い記事を並べる。ここでは保存しない
  const offerCandidates = async (forTerm: string) => {
    const found = await searchWikipediaCandidates(forTerm, languageCode)
    setCandidates(found.candidates)
    setCandidateLanguage(found.language_code)
    setMessage(found.message)
  }

  // 一度きり。再描画のたびに走ると、候補を選んでいる最中に引き直してしまう
  const autoStarted = useRef(false)

  const lookup = async (forTerm: string = term) => {
    setBusy(true)
    setMessage(null)
    setCandidates(null)
    try {
      const result = await fetchWikipediaSummary(forTerm, languageCode)
      if (!result.found) {
        // 記事が無いのは異常ではない。黙って諦めず、近い記事を出す
        await offerCandidates(forTerm)
        return
      }
      if (result.disambiguation) {
        // 曖昧さ回避のページは中身が一覧なので、そのまま出しても意味が取れない
        await offerCandidates(forTerm)
        return
      }
      onSaved(result.summary)
    } catch {
      setMessage('いま引けませんでした')
    } finally {
      setBusy(false)
    }
  }

  // 候補から1件選ぶ。**ここで初めて保存する**
  const choose = async (candidate: WikipediaCandidate) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await fetchWikipediaSummary(candidate.title, candidateLanguage ?? languageCode)
      if (!result.found || result.disambiguation) {
        setMessage('その記事は引けませんでした。別の候補を試してください。')
        return
      }
      setCandidates(null)
      onSaved(result.summary)
    } catch {
      setMessage('いま引けませんでした')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!shouldAutoLookup({ justCreated: autoLookup, hasValue: value != null, alreadyStarted: autoStarted.current })) {
      return
    }

    autoStarted.current = true
    void lookup()
    // lookup は毎回作り直されるので依存に入れない（入れると走り続ける）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLookup, value])

  /** 何で引くかの欄。**空欄は見出し語のまま**なので、見出し語を写して置かない */
  const termField = (
    <div className="space-y-1">
      <label className="block text-xs text-muted-foreground" htmlFor="wikipedia-term">
        調べる語
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          id="wikipedia-term"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            if (canLookup(draft, term)) void lookup(resolveLookupTerm(draft, term))
          }}
          disabled={busy}
          maxLength={MAX_TERM_LENGTH}
          placeholder={term}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => lookup(resolveLookupTerm(draft, term))}
          disabled={busy || !canLookup(draft, term)}
          className="flex shrink-0 items-center gap-1.5"
        >
          {busy ? <Spinner size={13} /> : <RefreshCw size={13} />}
          調べる
        </Button>
      </div>
      {/* 空欄のままでも引ける、と先に言う。消したら引けなくなると思わせない */}
      <p className="text-xs text-muted-foreground">
        空欄のままなら「{term}」で調べます。別の言い方や正式名称でも探せます。
      </p>
    </div>
  )

  const candidateList = candidates?.length ? (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        同じ題の記事がありませんでした。近いものから選んでください（{candidateLanguage} 版）
      </p>
      <ul className="space-y-1.5">
        {candidates.map((c) => (
          <li key={c.title} className="flex items-center gap-2.5">
            {c.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Wikimedia の画像。こちらに保存しない
              <img src={c.thumbnail_url} alt="" className="h-9 w-9 shrink-0 rounded border border-border object-cover" />
            ) : (
              <span className="h-9 w-9 shrink-0 rounded border border-dashed border-border" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{c.title}</span>
              {/* 題だけでは同名の別人・別作品を見分けられない。説明文が本体 */}
              {c.description && (
                <span className="block truncate text-xs text-muted-foreground">{c.description}</span>
              )}
            </span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => choose(c)} className="shrink-0 text-xs">
              この記事を選ぶ
            </Button>
          </li>
        ))}
      </ul>
    </div>
  ) : null

  if (!value) {
    return (
      <div className="space-y-2">
        {/* 見出し語がそのまま入るので、長い語だと札の幅を越える。
            札の幅で切って、全文は title で読めるようにする
            （切るのは語のほうだけ。「Wikipedia で調べる」が消えると何の釦か分からない） */}
        {editable ? termField : <p className="text-sm text-muted-foreground">未設定</p>}
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        {candidateList}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* 見出し（絵と題）。ここは送らない。何の記事かは、本文のどこを読んでいても見えている */}
      <div className="flex gap-3">
        {value.wikipedia_thumbnail_url &&
          (value.wikipedia_url ? (
            // 絵から記事へ行けるようにする。**出どころと、その画像の条件は記事の側にある**。
            // こちらに保存しないのは、保存するとその条件をこちらで背負うことになるため
            <a
              href={value.wikipedia_url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${value.wikipedia_title}（Wikipedia）`}
              className="shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia の画像。こちらに保存しない */}
              <img
                src={value.wikipedia_thumbnail_url}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-14 w-14 rounded-lg border border-border object-cover sm:h-16 sm:w-16"
              />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Wikimedia の画像。こちらに保存しない
            <img
              src={value.wikipedia_thumbnail_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover sm:h-16 sm:w-16"
            />
          ))}
        <p className="min-w-0 self-center text-sm font-medium">
          {value.wikipedia_title}
          {value.wikipedia_description && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {value.wikipedia_description}
            </span>
          )}
        </p>
      </div>

      {/* 冒頭は 500 字まで保存してある。札の高さで切ると読み切れないので、
          入り切らないぶんはここで送れるようにする。
          札そのものを伸ばさないのは、下の項目が押し出されるため。

          絵の横ではなく下に敷くのは、狭い画面で1行が数語になってしまうため。
          横に置くと、絵のぶんだけ本文が細くなる */}
      {value.wikipedia_extract && (
        <div
          ref={extractRef}
          onScroll={(e) => setMore(hasMoreBelow(e.currentTarget))}
          style={more ? { maskImage: FADE, WebkitMaskImage: FADE } : undefined}
          className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground sm:max-h-56"
        >
          {value.wikipedia_extract}
        </div>
      )}

      {/* 出どころとライセンス。CC BY-SA なので、これが読めない形で出さない */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {value.wikipedia_url && (
          <a
            href={value.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 underline-offset-2 hover:underline"
          >
            記事を読む
            <ExternalLink size={11} />
          </a>
        )}
        <span>
          Wikipedia より（
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.ja"
            target="_blank"
            rel="noopener noreferrer license"
            className="underline-offset-2 hover:underline"
          >
            CC BY-SA 4.0
          </a>
          ）
        </span>
        {editable && (
          <button
            type="button"
            onClick={() => lookup()}
            disabled={busy}
            className="flex items-center gap-1 hover:text-foreground disabled:opacity-50"
          >
            {busy ? <Spinner size={11} /> : <RefreshCw size={11} />}
            引き直す
          </button>
        )}
        {/* **別の記事へ移りたいときの口。** 見出し語で引き直しても同じ記事に戻るので、
            語を変えられないと、間違った記事から抜けられない */}
        {editable && (
          <button
            type="button"
            onClick={() => setEditingTerm((open) => !open)}
            disabled={busy}
            aria-expanded={editingTerm}
            className="hover:text-foreground disabled:opacity-50"
          >
            {editingTerm ? '語を変えるのをやめる' : '別の語で調べる'}
          </button>
        )}
      </p>

      {editable && editingTerm && termField}

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {candidateList}
    </div>
  )
}
