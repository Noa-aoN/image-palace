'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Sparkles, Loader2, Share2, Plug, SlidersHorizontal, Bell, Database, Image as ImageIcon, Boxes, Zap, Settings, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { exportAccountData } from '@/lib/api/account'
import { getSettings, updateSettings } from '@/lib/api/settings'
import { useSettingsStore } from '@/stores/settings'
import { LibraryOrderSetting } from '@/components/features/settings/LibraryOrderSetting'
import { WordDifficultySetting } from '@/components/features/settings/WordDifficultySetting'
import type { DiagramMode, MotionMode } from '@/types/settings'
import { STYLE_OPTIONS } from '@/lib/item-styles'
import { useUiStore } from '@/stores/ui'
import { ASPECT_RATIOS, ASPECT_RATIO_KEYS } from '@/lib/aspect-ratio'
import { DISPLAY_STYLES, DISPLAY_STYLE_KEYS, SHELF_ORIENTATIONS, SHELF_ORIENTATION_KEYS } from '@/lib/display-style'

type TabKey = 'generation' | 'display' | 'sharing' | 'notification' | 'integration' | 'data'

export default function SettingsPage() {
  // 生成オプション
  const [autoMeanings, setAutoMeanings] = useState<boolean | null>(null)
  const [autoTags, setAutoTags] = useState<boolean | null>(null)
  const [regenWithMeaning, setRegenWithMeaning] = useState<boolean | null>(null)
  const [imageSafeguard, setImageSafeguard] = useState<boolean | null>(null)
  // 自分が作らせた絵を、ほかの人にも使わせてよいか
  const [shareImages, setShareImages] = useState<boolean | null>(null)
  const [cardDetailColumns, setCardDetailColumns] = useState(1)
  const [savingSettings, setSavingSettings] = useState(false)
  // デフォルト画像スタイル（null = 読み込み中）
  const [defaultStyle, setDefaultStyle] = useState<string | null>(null)
  const [savingStyle, setSavingStyle] = useState(false)
  // 新規カードの既定の縦横比
  const [defaultAspect, setDefaultAspect] = useState<string | null>(null)
  const [savingAspect, setSavingAspect] = useState(false)
  // 一覧の見せ方（シンプル / 宮殿スタイル）。図の 2D/3D 設定とは別物なので名前を分ける
  const [listStyle, setListStyle] = useState<string | null>(null)
  const [savingListStyle, setSavingListStyle] = useState(false)
  const [shelfOrientation, setShelfOrientation] = useState<string | null>(null)
  const [savingShelf, setSavingShelf] = useState(false)
  // 生成ステータスバッジの表示（クライアント保持の表示設定）
  const showStatusBadges = useUiStore((s) => s.showStatusBadges)
  const changeCardDetailColumns = async (next: number) => {
    if (next === cardDetailColumns || savingSettings) return
    setSavingSettings(true)
    try {
      const s = await updateSettings({ card_detail_columns: next })
      setCardDetailColumns(s.card_detail_columns)
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleStatusBadges = useUiStore((s) => s.toggleStatusBadges)
  // 図の 2D/3D とアニメーション（アカウントの設定。図のコンポーネントも同じストアを見る）
  const diagramMode = useSettingsStore((s) => s.settings?.diagram_mode ?? null)
  const motionMode = useSettingsStore((s) => s.settings?.motion_mode ?? null)
  // 表示スタイル系も共有ストア経由で更新する。ライブラリ側が同じストアを見ているため、
  // API を直接叩くと画面を再読み込みするまで反映されない
  const patchSettings = useSettingsStore((s) => s.patchSettings)
  const fetchSettings = useSettingsStore((s) => s.fetchSettings)
  const [savingDisplay, setSavingDisplay] = useState(false)
  const [savingMotion, setSavingMotion] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then((s) => {
        if (cancelled) return
        setAutoMeanings(s.auto_generate_meanings)
        setAutoTags(s.auto_generate_tags)
        setRegenWithMeaning(s.regenerate_with_meaning)
        setImageSafeguard(s.image_safeguard)
        setShareImages(s.share_generated_images)
        setCardDetailColumns(s.card_detail_columns ?? 1)
        setDefaultStyle(s.default_image_style)
        setDefaultAspect(s.default_aspect_ratio)
        setListStyle(s.display_style)
        setShelfOrientation(s.shelf_orientation)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // 設定ストアが空（直リンクで開いた等）なら読み込む。
  useEffect(() => {
    if (diagramMode === null) fetchSettings()
  }, [diagramMode, fetchSettings])

  const changeDiagramMode = async (value: DiagramMode) => {
    if (savingDisplay) return
    setSavingDisplay(true)
    try {
      await patchSettings({ diagram_mode: value })
    } catch {
      // 失敗時はストア側で元に戻る
    } finally {
      setSavingDisplay(false)
    }
  }

  const changeMotionMode = async (value: MotionMode) => {
    if (savingMotion) return
    setSavingMotion(true)
    try {
      await patchSettings({ motion_mode: value })
    } catch {
      // 失敗時はストア側で元に戻る
    } finally {
      setSavingMotion(false)
    }
  }

  const changeListStyle = async (value: string) => {
    if (listStyle === null || savingListStyle) return
    const prev = listStyle
    setSavingListStyle(true)
    setListStyle(value)
    try {
      await patchSettings({ display_style: value })
    } catch {
      setListStyle(prev) // 失敗したら元に戻す
    } finally {
      setSavingListStyle(false)
    }
  }

  const changeShelfOrientation = async (value: string) => {
    if (shelfOrientation === null || savingShelf) return
    const prev = shelfOrientation
    setSavingShelf(true)
    setShelfOrientation(value)
    try {
      await patchSettings({ shelf_orientation: value })
    } catch {
      setShelfOrientation(prev) // 失敗したら元に戻す
    } finally {
      setSavingShelf(false)
    }
  }

  const changeDefaultAspect = async (value: string) => {
    if (defaultAspect === null || savingAspect) return
    const prev = defaultAspect
    setSavingAspect(true)
    setDefaultAspect(value)
    try {
      const s = await updateSettings({ default_aspect_ratio: value })
      setDefaultAspect(s.default_aspect_ratio)
    } catch {
      setDefaultAspect(prev) // 失敗したら元に戻す
    } finally {
      setSavingAspect(false)
    }
  }

  const changeDefaultStyle = async (value: string) => {
    if (defaultStyle === null || savingStyle) return
    const prev = defaultStyle
    setSavingStyle(true)
    setDefaultStyle(value)
    try {
      const s = await updateSettings({ default_image_style: value })
      setDefaultStyle(s.default_image_style)
    } catch {
      setDefaultStyle(prev) // 失敗したら元に戻す
    } finally {
      setSavingStyle(false)
    }
  }

  const toggleAutoMeanings = async () => {
    if (autoMeanings === null || savingSettings) return
    const next = !autoMeanings
    setSavingSettings(true)
    setAutoMeanings(next)
    try {
      const s = await updateSettings({ auto_generate_meanings: next })
      setAutoMeanings(s.auto_generate_meanings)
    } catch {
      setAutoMeanings(!next) // 失敗したら元に戻す
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleAutoTags = async () => {
    if (autoTags === null || savingSettings) return
    const next = !autoTags
    setSavingSettings(true)
    setAutoTags(next)
    try {
      const s = await updateSettings({ auto_generate_tags: next })
      setAutoTags(s.auto_generate_tags)
    } catch {
      setAutoTags(!next) // 失敗したら元に戻す
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleRegenMeaning = async () => {
    if (regenWithMeaning === null || savingSettings) return
    const next = !regenWithMeaning
    setSavingSettings(true)
    setRegenWithMeaning(next)
    try {
      const s = await updateSettings({ regenerate_with_meaning: next })
      setRegenWithMeaning(s.regenerate_with_meaning)
    } catch {
      setRegenWithMeaning(!next) // 失敗したら元に戻す
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleImageSafeguard = async () => {
    if (imageSafeguard === null || savingSettings) return
    const next = !imageSafeguard
    setSavingSettings(true)
    setImageSafeguard(next)
    try {
      const s = await updateSettings({ image_safeguard: next })
      setImageSafeguard(s.image_safeguard)
    } catch {
      setImageSafeguard(!next) // 失敗したら元に戻す
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleShareImages = async () => {
    if (shareImages === null || savingSettings) return
    const next = !shareImages
    setSavingSettings(true)
    setShareImages(next)
    try {
      const s = await updateSettings({ share_generated_images: next })
      setShareImages(s.share_generated_images)
    } catch {
      setShareImages(!next) // 失敗したら元に戻す
    } finally {
      setSavingSettings(false)
    }
  }

  // データエクスポート
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const data = await exportAccountData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `image-palace-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('エクスポートに失敗しました。時間を置いて再度お試しください。')
    } finally {
      setExporting(false)
    }
  }

  const Toggle = ({
    checked,
    label,
    disabled,
    onClick,
  }: {
    checked: boolean
    label: string
    disabled: boolean
    onClick: () => void
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-[var(--palace)]' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )

  const sections: CategorySection<TabKey>[] = [
    {
      key: 'generation',
      label: '生成',
      icon: <Sparkles size={16} />,
      content: (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">生成オプション</h2>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">カード作成時に意味・説明を自動生成</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ONにすると、新しいカードを作るたびに AI が意味・説明を自動生成します（生成コストがかかります）。
                  OFF の場合は、各カードの詳細画面から個別に生成できます。
                </p>
              </div>
              <Toggle
                checked={autoMeanings === true}
                label="意味・説明の自動生成"
                disabled={autoMeanings === null || savingSettings}
                onClick={toggleAutoMeanings}
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">カード作成時にタグを自動生成</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ONにすると、新しいカードを作るたびに AI が分類用タグを自動生成します（生成コストがかかります）。
                  OFF の場合は、各カードの詳細画面から個別に生成できます。既存のタグは消さず追加されます。
                </p>
              </div>
              <Toggle
                checked={autoTags === true}
                label="タグの自動生成"
                disabled={autoTags === null || savingSettings}
                onClick={toggleAutoTags}
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">再生成で意味・説明を参考にする（既定）</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  カードを再生成するときの「意味・説明を参考にする」の初期値です。
                  ONにすると、意味・説明のあるカードでは既定で参考にします（各再生成画面で個別に切り替え可）。
                </p>
              </div>
              <Toggle
                checked={regenWithMeaning === true}
                label="再生成で意味・説明を参考にする"
                disabled={regenWithMeaning === null || savingSettings}
                onClick={toggleRegenMeaning}
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">できた絵に覆いを掛ける</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI が作る絵は、思っていたものと違うことがあります。ONにすると、
                  できた絵をぼかした状態で出し、確かめてから「これでよい」を押すまで
                  はっきりとは表示しません。既にあるカードはそのままで、
                  ONにしたあとに作った絵だけが対象になります。
                </p>
              </div>
              <Toggle
                checked={imageSafeguard === true}
                label="できた絵に覆いを掛ける"
                disabled={imageSafeguard === null || savingSettings}
                onClick={toggleImageSafeguard}
              />
            </div>
            {/* 同じ指示の絵は世界で1回しか作らない。**得か、自分だけのものにするか** */}
            <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-4">
              <div className="min-w-0">
                <p className="font-medium">作った絵を、ほかの人にも使わせる</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  同じ指示で作られた絵は、世界で1回しか作りません。ONのままなら、
                  あなたが作らせた絵も、同じ指示を書いた人にそのまま渡ります
                  （その人はクレジットを使いますが、待ち時間はありません）。
                  OFFにすると、これから作る絵はあなただけのものになります。
                  <strong className="text-foreground">
                    OFFにしても、ほかの人が作った絵は今までどおり使えます。
                  </strong>
                </p>
              </div>
              <Toggle
                checked={shareImages === true}
                label="作った絵を、ほかの人にも使わせる"
                disabled={shareImages === null || savingSettings}
                onClick={toggleShareImages}
              />
            </div>

            {savingSettings && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> 保存中…
              </p>
            )}

          </section>

          {/* カードが持つ項目。種別ごとに決めるので、一望できる場所を別ページに置く */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Boxes size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">カードの項目</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              読み仮名・別名・発音記号など、カードに持たせる項目を種別ごとに決めます。
              足した項目は、その種別のカード全部に出ます。
            </p>
            <Link
              href="/settings/card-properties"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              項目を設定する
            </Link>
          </section>

          {/*
            神託（デルフォイ・デルフォイ）の設定は、カード生成の設定とは別物。
            上は「作ったカードに何を足すか」、こちらは「どんな単語を出してもらうか」で、
            効く相手が違う。同じ箱に入れていると、難しさが画像に効くように読める。
          */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Wand2 size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">神託（デルフォイ）の単語</h2>
            </div>
            <WordDifficultySetting />
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ImageIcon size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">デフォルト画像スタイル</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              新しくカードを作るときの画像スタイルの初期値です。各カードの作成時に個別で変更できます。
            </p>
            <div className="flex items-center gap-2">
              <select
                aria-label="デフォルト画像スタイル"
                value={defaultStyle ?? ''}
                disabled={defaultStyle === null || savingStyle}
                onChange={(e) => changeDefaultStyle(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                {STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {savingStyle && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </div>
          </section>

          {/* 画像の形（縦横比）。カード作成時に個別で上書きできる */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ImageIcon size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">デフォルト画像の形</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              新しくカードを作るときの縦横比の初期値です。各カードの作成時に個別で変更できます。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {ASPECT_RATIO_KEYS.map((key) => {
                const opt = ASPECT_RATIOS[key]
                const active = defaultAspect === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeDefaultAspect(key)}
                    disabled={defaultAspect === null || savingAspect}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                      active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                  >
                    <span
                      aria-hidden
                      className="w-3 shrink-0 rounded-[2px] border border-current opacity-70"
                      style={{ aspectRatio: opt.css }}
                    />
                    {opt.label}
                    {opt.note && <span className="text-[10px] opacity-70">（{opt.note}）</span>}
                  </button>
                )
              })}
              {savingAspect && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </div>
          </section>

          <ComingSoon
            title="生成の詳細設定"
            icon={<Sparkles size={18} />}
            description="画像サイズ・品質、説明文の長さ、生成情報の保存などは順次対応予定です。"
            items={['画像の品質', '説明文の長さ', '生成情報を保存', '生成後の公開状態']}
          />
        </>
      ),
    },
    {
      key: 'display',
      label: '表示・操作',
      icon: <SlidersHorizontal size={16} />,
      content: (
        <>
          {/* 一覧の見せ方。場（ライブラリ/アトリエ/スタディ）ごとの器を使うかどうか */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ImageIcon size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">一覧の見せ方</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              ライブラリやアトリエなど、一覧ページ全体の見せ方を切り替えます。
            </p>
            <div className="space-y-2">
              {DISPLAY_STYLE_KEYS.map((key) => {
                const opt = DISPLAY_STYLES[key]
                const active = listStyle === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeListStyle(key)}
                    disabled={listStyle === null || savingListStyle}
                    aria-pressed={active}
                    className={`w-full rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
                      active ? 'border-[var(--palace)] bg-[var(--palace)]/10' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
                  </button>
                )
              })}
              {savingListStyle && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </div>

            {/* 棚の並べ方。宮殿スタイルのときだけ意味を持つ従属設定なので、その中に入れ子で置く */}
            {listStyle === 'palace' && (
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                <p className="text-sm font-medium">棚の並べ方</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SHELF_ORIENTATION_KEYS.map((key) => {
                    const opt = SHELF_ORIENTATIONS[key]
                    const active = shelfOrientation === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => changeShelfOrientation(key)}
                        disabled={shelfOrientation === null || savingShelf}
                        aria-pressed={active}
                        className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                          active ? 'border-[var(--palace)] bg-[var(--palace)]/10' : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        <span className="text-sm font-medium">{opt.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
                      </button>
                    )
                  })}
                </div>
                {savingShelf && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              </div>
            )}

            {/* 棚の並び順。宮殿・シンプルどちらの見せ方でも棚の順番は効く */}
            <LibraryOrderSetting />
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">カードの表示</h2>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">生成ステータスのバッジを表示</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  カードの「生成待ち」「生成中」「失敗」バッジを表示します。完了したカードは画像のみ表示され、バッジは出ません。
                  OFF にするとバッジをすべて隠します。
                </p>
              </div>
              <Toggle
                checked={showStatusBadges}
                label="生成ステータスのバッジを表示"
                disabled={false}
                onClick={toggleStatusBadges}
              />
            </div>

            {/* ここで決めるのは既定。1枚ごとの列数はカード詳細の「表示」で変えられる
                （項目の少ないカードは1列、多いカードは2列、と使い分けたくなる） */}
            <div className="border-t border-border pt-3">
              <p className="text-sm font-medium">カード詳細の列の数</p>
              <p className="mt-1 text-sm text-muted-foreground">
                項目を何列に並べるかの既定です。狭い画面では自動で1列に戻ります。
                1枚ごとの列数は、カード詳細の「表示」から変えられます。
              </p>
              <div className="mt-2 flex gap-1.5">
                {[ 1, 2, 3 ].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => changeCardDetailColumns(count)}
                    disabled={savingSettings}
                    className={`rounded-lg border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                      cardDetailColumns === count
                        ? 'border-[var(--palace)] text-[var(--palace)]'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Boxes size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">図の表示</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              宮殿の間取り図・記憶資産などの図を、平面（2D）と立体（3D）のどちらで描くかを選びます。
              各カードのトグルで、図ごとに個別に切り替えることもできます。
            </p>
            <div className="flex items-center gap-2">
              <select
                aria-label="図の表示"
                value={diagramMode ?? '3d'}
                disabled={diagramMode === null || savingDisplay}
                onChange={(e) => changeDiagramMode(e.target.value as DiagramMode)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="3d">3D（立体）</option>
                <option value="2d">2D（平面）</option>
              </select>
              {savingDisplay && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Zap size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">アニメーション</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              画面の動き（トップページの演出、図の切り替えなど）を動かすかどうかを選びます。
              「自動」は端末（OS）の「視差効果を減らす」設定に従います。
            </p>
            <div className="flex items-center gap-2">
              <select
                aria-label="アニメーション"
                value={motionMode ?? 'auto'}
                disabled={motionMode === null || savingMotion}
                onChange={(e) => changeMotionMode(e.target.value as MotionMode)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="auto">自動（端末の設定に従う）</option>
                <option value="on">ON（動かす）</option>
                <option value="off">OFF（止める）</option>
              </select>
              {savingMotion && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </div>
          </section>

          <ComingSoon
            description="詳細ページの表示モード、ホバー説明、シンプル表示などは順次対応予定です。"
            items={['詳細ページの表示モード', 'ホバー説明', 'シンプル表示']}
          />
        </>
      ),
    },
    {
      key: 'sharing',
      label: '共有・公開',
      icon: <Share2 size={16} />,
      content: (
        <ComingSoon
          description="公開範囲・共有リンク・アゴラ公開・販売などの設定は順次対応予定です。"
          items={['デフォルト公開範囲', '共有リンク設定', 'アゴラ公開設定', '取り寄せ / 派生許可', '販売設定']}
        />
      ),
    },
    {
      key: 'notification',
      label: '通知',
      icon: <Bell size={16} />,
      content: (
        <ComingSoon
          description="生成完了・クレジット回復・支払い・お知らせなどの通知設定は順次対応予定です。"
          items={['生成完了通知', 'クレジット回復通知', '支払い通知', '共有 / アゴラ通知', 'メール通知']}
        />
      ),
    },
    {
      key: 'integration',
      label: '連携',
      icon: <Plug size={16} />,
      content: (
        <ComingSoon
          description="BYOK（自分のAPIキー利用）・外部サービス連携・Webhook は順次対応予定です。"
          items={['BYOK / 各種 API Key', 'MCP 設定', 'Notion 連携', 'Google Drive 連携', 'Webhook']}
        />
      ),
    },
    {
      key: 'data',
      label: 'データ管理',
      icon: <Database size={16} />,
      content: (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Download size={18} style={{ color: 'var(--palace)' }} />
              <h2 className="text-lg font-semibold">データのエクスポート</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              あなたのカード・デッキ・ボックスなどのデータを JSON 形式でダウンロードします。
            </p>
            <Button onClick={handleExport} disabled={exporting} className="flex items-center gap-1">
              <Download size={15} />
              {exporting ? 'エクスポート中…' : 'データをエクスポート'}
            </Button>
            {exportError && <p className="text-sm text-destructive">{exportError}</p>}
          </section>

          <ComingSoon
            title="その他のデータ管理"
            icon={<Database size={18} />}
            description="ゴミ箱・クリーンルーム・各種履歴の管理は順次対応予定です。"
            items={['ゴミ箱', 'クリーンルーム', '生成 / 画像 / 削除履歴', 'クレジット履歴']}
          />
        </>
      ),
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-8">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <Settings size={26} style={{ color: 'var(--palace)' }} />
            環境設定
          </h1>
          <p className="mt-2 text-muted-foreground">
            生成・共有・連携・通知・データ管理など、利用環境を整えます。
          </p>
        </div>

        <CategorySections sections={sections} ariaLabel="環境設定カテゴリ" />
      </div>
    </div>
  )
}
