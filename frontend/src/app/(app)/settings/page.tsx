'use client'

import { useEffect, useState } from 'react'
import { Download, Sparkles, Loader2, Share2, Plug, SlidersHorizontal, Bell, Database, Image as ImageIcon, Boxes, Zap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { exportAccountData } from '@/lib/api/account'
import { getSettings, updateSettings } from '@/lib/api/settings'
import { useSettingsStore } from '@/stores/settings'
import type { DiagramMode, MotionMode } from '@/types/settings'
import { STYLE_OPTIONS } from '@/lib/item-styles'
import { useUiStore } from '@/stores/ui'

type TabKey = 'generation' | 'display' | 'sharing' | 'notification' | 'integration' | 'data'

export default function SettingsPage() {
  // 生成オプション
  const [autoMeanings, setAutoMeanings] = useState<boolean | null>(null)
  const [autoTags, setAutoTags] = useState<boolean | null>(null)
  const [regenWithMeaning, setRegenWithMeaning] = useState<boolean | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  // デフォルト画像スタイル（null = 読み込み中）
  const [defaultStyle, setDefaultStyle] = useState<string | null>(null)
  const [savingStyle, setSavingStyle] = useState(false)
  // 生成ステータスバッジの表示（クライアント保持の表示設定）
  const showStatusBadges = useUiStore((s) => s.showStatusBadges)
  const toggleStatusBadges = useUiStore((s) => s.toggleStatusBadges)
  // 図の 2D/3D とアニメーション（アカウントの設定。図のコンポーネントも同じストアを見る）
  const diagramMode = useSettingsStore((s) => s.settings?.diagram_mode ?? null)
  const motionMode = useSettingsStore((s) => s.settings?.motion_mode ?? null)
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
        setDefaultStyle(s.default_image_style)
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
            {savingSettings && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> 保存中…
              </p>
            )}
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

          <ComingSoon
            title="生成の詳細設定"
            icon={<Sparkles size={18} />}
            description="画像サイズ・品質、説明文の長さ、生成情報の保存などは順次対応予定です。"
            items={['画像サイズ / 品質', '説明文の長さ', '生成情報を保存', '生成後の公開状態']}
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
      <div className="max-w-3xl mx-auto space-y-8">
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
