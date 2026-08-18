'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, BookImage, Coins, Compass, GalleryHorizontal, LayoutGrid, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSettings, updateSettings } from '@/lib/api/settings'
import { getProfile, updateProfile } from '@/lib/api/account'
import { useSettingsStore } from '@/stores/settings'
import { DISPLAY_STYLES, DISPLAY_STYLE_KEYS, DEFAULT_DISPLAY_STYLE, type DisplayStyle } from '@/lib/display-style'
import { AI_TEXT_COST, CREDIT_UNIT_SHORT, TRIAL_CREDITS, MONTHLY_FREE_CREDITS, INITIAL_CREDITS } from '@/lib/billing'
import {
  EMPTY_DRAFT,
  ONBOARDING_STEP_COUNT,
  clampIndex,
  draftToPayloads,
  isLastStep,
  progressLabel,
  progressRatio,
  stepAt,
  type OnboardingDraft,
} from '@/lib/onboarding/steps'
import { persist } from '@/lib/api/persist'

/**
 * 登録直後に一度だけ出す案内。
 *
 * 前は「一覧の見せ方」だけを聞いていた。**初めての人が最初に受け取る言葉が
 * 設定の質問**では、何のサービスなのか分からないまま設定させることになる。
 *
 * 順番は「何ができるか → あなたの名前 → 言葉の意味 → 宮殿の名前 → 設定」。
 * 説明と入力を交互に置いて、入力が続かないようにしている。
 *
 * 保存は**最後にまとめて1回**。途中で閉じた人には何も起きず、次にまた出る。
 * 一歩ごとに書くと、離脱した人の設定だけが中途半端に決まってしまう。
 */
export function OnboardingFlow() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT)
  const [currentName, setCurrentName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    getSettings()
      .then((s) => {
        if (!alive || s.onboarded) return
        setDraft((d) => ({
          ...d,
          palaceName: s.palace_name ?? '',
          displayStyle: (s.display_style as DisplayStyle) || DEFAULT_DISPLAY_STYLE,
        }))
        setOpen(true)

        // 名前は OAuth が持ってきていることがある。**入力欄に最初から入れておく**
        // （空欄から書かせると、既にある名前を消すつもりが無くても消える）
        getProfile()
          .then((p) => {
            if (!alive) return
            setCurrentName(p.name)
            setDraft((d) => ({ ...d, name: p.name ?? '' }))
          })
          .catch(() => {})
      })
      .catch(() => {
        // 設定が取れないときは何も出さない（初回体験を邪魔しない）
      })
    return () => {
      alive = false
    }
  }, [])

  if (!open) return null

  const step = stepAt(index)
  if (!step) return null

  const go = (to: number) => setIndex(clampIndex(to))

  const finish = async (thenCreate: boolean) => {
    setSaving(true)
    const { profile, settings } = draftToPayloads(draft, { name: currentName })
    try {
      // 名前の保存に失敗しても、案内は閉じる。**ここで人を閉じ込めない**
      if (profile) await persist(() => updateProfile(profile))
      await updateSettings(settings)
      await useSettingsStore.getState().fetchSettings()
    } catch {
      // 保存に失敗しても閉じる。設定画面からいつでも変更できる
    } finally {
      setOpen(false)
      setSaving(false)
      if (thenCreate) router.push('/items/new')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="はじめかたの案内"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
    >
      {/* モバイルは下端に貼り付けて全幅。画面の高さが足りないときは中身だけが縦に流れる */}
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[86dvh] sm:rounded-2xl">
        {/* 進捗。**いま何枚目か・あと何枚か**が分からないと、終わりの見えない質問に見える */}
        <div className="shrink-0 space-y-2 border-b border-border/70 px-6 pt-5 pb-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{step.title}</h2>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{progressLabel(index)}</span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={ONBOARDING_STEP_COUNT}
            aria-label="案内の進みぐあい"
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progressRatio(index) * 100}%`, backgroundColor: 'var(--palace)' }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step.key === 'welcome' && <WelcomeStep />}
          {step.key === 'profile' && (
            <NameStep
              label="表示名"
              hint="呼びかけに使います。あとから変えられます。"
              placeholder="のあ"
              value={draft.name}
              onChange={(name) => setDraft((d) => ({ ...d, name }))}
            />
          )}
          {step.key === 'concepts' && <ConceptsStep />}
          {step.key === 'palace' && (
            <NameStep
              label="宮殿の名前"
              hint="あなたの記憶の置き場所の呼び名です。あとから変えられます。"
              placeholder="記憶の宮殿"
              value={draft.palaceName}
              onChange={(palaceName) => setDraft((d) => ({ ...d, palaceName }))}
            />
          )}
          {step.key === 'settings' && (
            <DisplayStyleStep
              value={draft.displayStyle}
              onChange={(displayStyle) => setDraft((d) => ({ ...d, displayStyle }))}
            />
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/70 px-6 pt-4 pb-5">
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button type="button" variant="ghost" onClick={() => go(index - 1)} disabled={saving}>
                戻る
              </Button>
            )}
            <div className="flex-1" />
            {/* 飛ばせるものは、飛ばせると書いてある場所を用意する */}
            {step.skippable && !isLastStep(index) && (
              <Button type="button" variant="ghost" onClick={() => go(index + 1)} disabled={saving}>
                スキップ
              </Button>
            )}
            {isLastStep(index) ? (
              <Button type="button" onClick={() => finish(true)} disabled={saving}>
                最初のメモリーカードを作る
              </Button>
            ) : (
              <Button type="button" onClick={() => go(index + 1)} disabled={saving}>
                次へ
              </Button>
            )}
          </div>
          {isLastStep(index) && (
            <button
              type="button"
              onClick={() => finish(false)}
              disabled={saving}
              className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              あとで作る（宮殿を見てまわる）
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function WelcomeStep() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed">
        覚えたいこと・残したいことを書くと、AI がその情景を絵にします。
        絵と言葉が一枚になった<strong className="font-semibold">メモリーカード</strong>が、
        IMAGE PALACE の記憶の基本の単位です。
      </p>
      <ul className="space-y-2.5">
        {[
          { icon: <BookImage size={18} />, text: '単語帳・学習図鑑・用語集として' },
          { icon: <Sparkles size={18} />, text: 'ビジョンボード・絵日記として' },
          { icon: <Compass size={18} />, text: '集めたカードは、自分だけの宮殿に並べて眺められます' },
        ].map((row, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}
            >
              {row.icon}
            </span>
            <span className="leading-relaxed">{row.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ConceptsStep() {
  // 独自の呼び名は、ここで一度だけまとめて説明する。
  // 画面のあちこちで初めて出会うと、そのたびに手が止まる
  //
  // 小さいものから大きいものへ並べる。1枚（カード）→ 広げる場（キャンバス）→ 全体（宮殿）。
  // 逆順にすると、まだ中身を知らないうちに入れ物の話から始まる
  const terms = [
    { icon: <GalleryHorizontal size={18} />, name: 'カード', text: '絵と言葉が一枚になったもの。すべての基本' },
    {
      icon: <LayoutGrid size={18} />,
      name: 'キャンバス',
      text: 'カードを広げて使う場。線でつないで関係を描く・並べて見比べる・その場で作り足す',
    },
    { icon: <Compass size={18} />, name: '宮殿', text: 'あなたの持ちもの全部の置き場所であり、作りかける作業場でもある' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        IMAGE PALACE には、いくつか独自の呼び名があります。3つだけ覚えれば十分です。
      </p>
      <dl className="space-y-3">
        {terms.map((t) => (
          <div key={t.name} className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}
            >
              {t.icon}
            </span>
            <div className="min-w-0">
              <dt className="text-sm font-medium">{t.name}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t.text}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  )
}

function NameStep({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string
  hint: string
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="onboarding-name" className="block text-sm font-medium">
        {label}
        <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
          任意
        </span>
      </label>
      <input
        id="onboarding-name"
        // 入力欄が1つしか無いので、開いた瞬間に書き始められるようにする
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={50}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-[var(--palace)] focus:outline-none"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function DisplayStyleStep({ value, onChange }: { value: DisplayStyle; onChange: (v: DisplayStyle) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">一覧の見せ方</p>
      <div className="space-y-2">
        {DISPLAY_STYLE_KEYS.map((key) => {
          const opt = DISPLAY_STYLES[key]
          const active = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={active}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                active ? 'border-[var(--palace)] bg-[var(--palace)]/10' : 'border-border hover:bg-muted'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {opt.label}
                {key === DEFAULT_DISPLAY_STYLE && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    おすすめ
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        ここで決めたものは、あとから環境設定でいつでも変えられます。
      </p>

      {/* 作り始める直前に、**お金の話だけ**を置く。
          ここを逃すと「押してから消費量を知る」ことになる。
          並べるのは3行まで — 覚えられない量を出しても読まれない */}
      <div className="space-y-1.5 rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Coins size={15} style={{ color: 'var(--palace)' }} />
          はじめる前に
        </p>
        <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          <li>
            画像生成AIで絵を1枚つくるたびに <strong className="font-medium text-foreground">1{CREDIT_UNIT_SHORT}</strong> 使います。
          </li>
          <li>
            はじめは {INITIAL_CREDITS}{CREDIT_UNIT_SHORT} あります
            （お試し {TRIAL_CREDITS}{CREDIT_UNIT_SHORT} ＋ 当月分 {MONTHLY_FREE_CREDITS}{CREDIT_UNIT_SHORT}）。
          </li>
          <li>残りはいつでも画面上のヘッダーで確認できます。</li>
        </ul>

        {/*
          ここだけ⚠を付ける。
          **「1枚 = 1cr」と覚えたまま作ると、引かれた数が合わなくなる。**
          意味・タグ・種別・項目の自動生成は、それぞれ別に文章のAIを使う。
          実際に「1枚しか作っていないのに 1cr 以上減った」という声が届いている。
          作成画面では選ぶ場所と合計の両方に出しているが、**最初に一度**
          「絵以外にもかかる」と言っておかないと、数を見た時に驚くことになる。
        */}
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50/60 px-2.5 py-2 text-xs leading-relaxed text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-medium">絵のほかに、AI を使うオプションにも少しかかります。</strong>
            {' '}カード作成の「意味・タグ・種別・項目」の自動生成は、
            画像生成AIとは別に1回 {AI_TEXT_COST}{CREDIT_UNIT_SHORT} 使います。
            たとえば1枚を全部入りで作ると {1 + AI_TEXT_COST * 4}{CREDIT_UNIT_SHORT}。
            使う数は作成画面に出るので、押す前に確かめられます。
          </span>
        </p>
        {/* 別の窓で開く。ここで移ってしまうと、案内が途中で消えて次回また最初から出る */}
        <a
          href="/guide"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs underline underline-offset-2 hover:text-foreground"
        >
          詳しい使い方を見る
        </a>
      </div>
    </div>
  )
}
