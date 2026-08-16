'use client'

import { useEffect, useState } from 'react'
import { Medal, Sparkles, Trophy, Award, Gem, HelpCircle, Route, ScrollText, History } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { REWARD_KIND_HELP } from '@/lib/reward-kinds'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import {
  getAchievements,
  toggleStar,
  type AchievementsPage,
  type RewardKind,
} from '@/lib/api/achievements'
import { RewardCard, RewardArt } from './RewardCard'
import { RewardDetail } from './RewardDetail'
import { RewardPreviews } from './RewardPreviews'
import { KIND_SHOWCASE_ORDER } from '@/lib/achievements/kind-order'
import { MissionSeriesCard } from './MissionSeriesCard'

/**
 * 栄誉の間。
 *
 * 未獲得のものも**名前と条件を出す**。何を目指せるか分からないと目標にならない。
 * ただし持っていないものは色を落とし、鍵を掛けて、持っているものと見分けが付くようにする。
 *
 * 並びは「いまの自分 → もうすぐ取れる → 今日やること → 集めたもの → 積み上げた数字」。
 * 眺めて嬉しくなる順ではなく、**次の行動が決まる順**にしてある。
 */
export function AchievementsBoard() {
  const [page, setPage] = useState<AchievementsPage | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // 種別（何を見るか）と、状態（持っているか）は別の軸。混ぜると
  // 「未獲得の勲章だけ」が選べなくなる
  const [kindFilter, setKindFilter] = useState<'all' | RewardKind>('all')
  const [ownFilter, setOwnFilter] = useState<'all' | 'owned' | 'locked'>('all')
  // 押した札の詳細。狭い画面ではホバーが無いので、これが唯一の説明になる
  const [openKey, setOpenKey] = useState<string | null>(null)
  // 絵だけ並べる。名前と説明を省くと、集めたものを眺める面になる
  const [imageOnly, setImageOnly] = useState(false)

  useEffect(() => {
    getAchievements()
      .then(setPage)
      .catch(() => setError(true))
  }, [])

  const act = async (key: string, fn: () => Promise<AchievementsPage>) => {
    setBusy(key)
    try {
      setPage(await fn())
    } catch {
      // 失敗しても画面は壊さない。もう一度押せばよい
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="text-sm text-destructive">読み込めませんでした。</p>
  if (!page) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  const rewards = page.rewards.filter((r) => {
    if (kindFilter !== 'all' && r.kind !== kindFilter) return false
    if (ownFilter === 'owned') return r.owned
    if (ownFilter === 'locked') return !r.owned
    return true
  })

  // 種別ごとに折り返して並べる。ひと続きにすると、どこから別の種類か分からない
  const KIND_ORDER: RewardKind[] = ['title', 'medal', 'treasure', 'honor']
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    label: page.rewards.find((r) => r.kind === kind)?.kind_label ?? kind,
    rows: rewards.filter((r) => r.kind === kind),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="space-y-8">
      {/* ── 記名板とサマリー ──
          左は「いま何を掲げているか」、右は「どれだけ積み上げたか」。
          1枚に混ぜると、見せるものと数える数字が同じ面に並んで、どちらも薄くなる */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {/* 見出しは札の中ではなく**外**に置く。下に続く「もうすぐ獲得」「獲得物」と
            同じ形に揃えないと、同じ大きさの話なのに、ここだけ札の中の小見出しに見える */}
        <section className="flex flex-col gap-3">
          {/* 王冠はページの見出し（アチーブメント）が使っている。
              同じ絵を2つ並べると、どちらが上位の見出しなのか読めなくなる。
              名乗りを書き入れる板なので、巻物にする */}
          <SectionTitle
            icon={<ScrollText size={18} />}
            // 称号と勲章が並ぶのはここ。**何が何かを知りたくなるのもここ**。
            // エントランスの札からは説明を外し、種別の意味はこの1か所で開く
            action={<RewardKindsHelp />}
          >
            記名板
          </SectionTitle>

          <div className="flex-1 space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            {/* 下に並ぶ勲章・宝物・表彰と同じ形にする。
                ここだけ絵記号だと、**何の行なのかを絵から読み取らせる**ことになり、
                同じ板の中で読み方が2通りになる */}
            <span className="w-8 shrink-0 text-xs text-muted-foreground">{KIND_LABELS.title}</span>
            {/* 括弧は付けない。左に「称号」の文字ラベルがあるので、
                囲いは二重になる（宮殿の主人カードと同じ扱いに揃えた） */}
            {page.summary.title ? (
              <span className="text-lg font-semibold">{page.summary.title.name}</span>
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">まだ名乗っていません</span>
            )}
          </div>

          {/* 「ありません」で終わらせない。次に何をすれば名乗れるかを出す */}
          {!page.summary.title && page.summary.next_title && (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              {page.summary.next_title.condition ?? 'もう少し進める'}と、称号
              <strong className="mx-1">「{page.summary.next_title.name}」</strong>
              を獲得できます
              {page.summary.next_title.remaining > 0 && (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  （あと {page.summary.next_title.remaining}）
                </span>
              )}
            </p>
          )}

          {/* 星を入れたものを種別ごとに並べる。出す場所が種別で違うので、ここでも分ける */}
          {KIND_SHOWCASE_ORDER.map((kind) => {
            const rows = page.summary.showcase[kind] ?? []
            if (rows.length === 0) return null
            return (
              <div key={kind} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-xs text-muted-foreground">{rows[0].kind_label}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {rows.map((reward) => (
                    <span key={reward.key} title={reward.name}>
                      <RewardArt reward={reward} size={26} />
                    </span>
                  ))}
                </span>
              </div>
            )
          })}

          {page.summary.rewards_earned === 0 && (
            <p className="text-xs text-muted-foreground">
              獲得したものに星を入れると、ここに並びます。
            </p>
          )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle icon={<History size={18} />}>まとめ</SectionTitle>

          <div className="flex-1 space-y-3 rounded-xl border border-border bg-card p-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(page.summary.counts) as RewardKind[]).map((kind) => {
              const c = page.summary.counts[kind]
              return (
                <SummaryStat
                  key={kind}
                  label={KIND_LABELS[kind]}
                  value={c.owned}
                  suffix={` / ${c.total}`}
                />
              )
            })}
          </dl>

          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
            <SummaryStat
              label="達成した実績"
              value={page.summary.achievements_completed}
              suffix={` / ${page.summary.achievements_total}`}
            />
            <SummaryStat label="入居から" value={page.summary.days_since_joined} suffix="日" />
            <SummaryStat label="学習した日" value={page.summary.active_days} suffix="日" />
            <SummaryStat label="続いている" value={page.summary.streak_days} suffix="日" />
          </dl>
          </div>
        </section>
      </div>

      {/* ── もうすぐ獲得 ── */}
      {page.upcoming.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={<Sparkles size={18} />}>もうすぐ獲得</SectionTitle>
          <ul className="space-y-2">
            {page.upcoming.map((row) => (
              // もらえるものは条件と同じ行の右端に置く。下に別の行で並べると、
              // 1件あたり4行になって、数が増えるほど読み流す面になる
              <li key={row.key} className="space-y-1 rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">あと {row.remaining} で</span>
                  <div className="flex min-w-0 items-center gap-2">
                    {/* もうすぐ獲得＝まだ手に入れていない */}
                    <RewardPreviews rewards={row.rewards} earned={false} />
                    <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                      {row.progress} / {row.target}
                    </span>
                  </div>
                </div>
                <Bar value={row.progress} max={row.target} />
                {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 道のり（シリーズ） ── */}
      {page.mission_series.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={<Route size={18} />}>道のり</SectionTitle>
          <ul className="space-y-2">
            {page.mission_series.map((series) => (
              <MissionSeriesCard key={series.key} series={series} />
            ))}
          </ul>
        </section>
      )}

      {/* ── 進行中のミッション ── */}
      {page.missions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={<Trophy size={18} />}>ミッション</SectionTitle>
          <ul className="space-y-2">
            {page.missions.map((mission) => (
              <li
                key={mission.key}
                className={`space-y-1.5 rounded-xl border p-4 ${
                  mission.completed ? 'border-[var(--palace)]/40 bg-card' : 'border-border bg-card'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {mission.cadence_label}
                    </span>
                    <span className={mission.completed ? 'text-muted-foreground line-through' : 'font-medium'}>
                      {mission.name}
                    </span>
                  </span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {mission.completed ? '達成' : `${mission.progress} / ${mission.target}`}
                  </span>
                </div>
                {!mission.completed && <Bar value={mission.progress} max={mission.target} />}
                {/* 「やること」ではなく「報酬への道」に見せる。何が貰えるか分からないと、やる気にならない */}
                <RewardPreviews rewards={mission.rewards} earned={mission.completed} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 獲得物 ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <SectionTitle icon={<Medal size={18} />}>獲得物</SectionTitle>
          {/* 種別の意味は毎回は要らないが、初めて見る人には要る。開いたときだけ出す */}
          <RewardKindsHelp />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['all', 'すべて'],
              ['title', '称号'],
              ['medal', '勲章'],
              ['honor', '表彰'],
              ['treasure', '宝物'],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={kindFilter === value} onClick={() => setKindFilter(value)}>
              {label}
            </Chip>
          ))}

          {/* 状態は別の軸なので、行の反対側へ寄せる */}
          <div className="ml-auto flex items-center gap-1.5">
            <Chip active={imageOnly} onClick={() => setImageOnly((v) => !v)} subtle>
              絵だけ
            </Chip>
            <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
            {(
              [
                ['all', 'すべて'],
                ['owned', '獲得済み'],
                ['locked', '未獲得'],
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} active={ownFilter === value} onClick={() => setOwnFilter(value)} subtle>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">ここに出せるものがありません。</p>
        ) : (
          groups.map((group) => (
            <div key={group.kind} className="space-y-2">
              <h3 className="flex items-baseline gap-2 text-sm font-medium">
                {group.label}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {group.rows.filter((r) => r.owned).length} / {group.rows.length}
                </span>
              </h3>
              <ul
                className={
                  imageOnly
                    ? 'grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10'
                    : 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6'
                }
              >
                {group.rows.map((reward) => (
                  <li key={reward.key}>
                    <RewardCard
                      reward={reward}
                      onOpen={() => setOpenKey(reward.key)}
                      onToggleStar={() => act(reward.key, () => toggleStar(reward.key))}
                      busy={busy === reward.key}
                      imageOnly={imageOnly}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* ── 実績（分類ごと） ── */}
      <section className="space-y-4">
        <SectionTitle icon={<Award size={18} />}>実績</SectionTitle>
        {/* 分類ごとに分ける。1本の長い列にすると、どこを見ればよいか分からない */}
        {page.categories.map((category) => {
          const rows = page.achievements.filter((a) => (a.category ?? 'その他') === category)
          if (rows.length === 0) return null

          const done = rows.filter((r) => r.completed_at).length
          return (
            <div key={category} className="space-y-2">
              <h3 className="flex items-baseline gap-2 text-sm font-medium">
                {category}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {done} / {rows.length}
                </span>
              </h3>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.key} className="space-y-1 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className={row.completed_at ? 'font-medium' : 'font-medium text-muted-foreground'}>
                        {row.name}
                      </span>
                      <div className="flex min-w-0 items-center gap-2">
                        <RewardPreviews rewards={row.rewards} earned={Boolean(row.completed_at)} />
                        <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                          {row.completed_at
                            ? `達成（${new Date(row.completed_at).toLocaleDateString('ja-JP')}）`
                            : `${row.progress} / ${row.condition_target}`}
                        </span>
                      </div>
                    </div>
                    {!row.completed_at && <Bar value={row.progress} max={row.condition_target} />}
                    {/* 達成したものの説明は畳む。**残っているものだけが、これからやること** */}
                    {row.description && !row.completed_at && (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      {/* 押した札の詳細。狭い画面ではホバーが無いので、ここが唯一の説明になる */}
      {openKey && (() => {
        const reward = page.rewards.find((r) => r.key === openKey)
        if (!reward) return null
        return (
          <RewardDetail
            reward={reward}
            busy={busy === reward.key}
            onClose={() => setOpenKey(null)}
            onToggleStar={() => act(reward.key, () => toggleStar(reward.key))}
          />
        )
      })()}

      {/* ── 記録（石板） ── */}
      <section className="space-y-3">
        <SectionTitle icon={<Gem size={18} />}>記録</SectionTitle>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {page.stats.map((row) => (
            <div
              key={row.key}
              className="rounded-xl border border-border bg-[color-mix(in_srgb,var(--card)_92%,var(--foreground))] p-3 text-center"
            >
              <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {row.value.toLocaleString()}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{row.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

/**
 * 報酬の下見。何が貰えるか分からないと「やってみよう」と思えない。
 *
 * まだ手に入れていないものは色を落とす。**取りに行く場所**なので、
 * 色が付いていると既に持っているように見える。
 *
 * 行の右端へ寄せる。名前や進捗は左から読むもので、報酬は「その先にあるもの」。
 * 同じ列に混ぜると、どこまでが条件でどこからが報酬なのか分からなくなる。
 */
function SectionTitle({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  /** 見出しの右へ置くもの（「?」など）。見出しの文字の中には入れない */
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span style={{ color: 'var(--palace)' }}>{icon}</span>
        {children}
      </h2>
      {action}
    </div>
  )
}


function Bar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${ratio * 100}%`, backgroundColor: 'var(--palace)' }}
      />
    </div>
  )
}

function Chip({
  active,
  onClick,
  subtle,
  children,
}: {
  active: boolean
  onClick: () => void
  /** 副軸（状態）はやや控えめに。主軸（種別）と同じ強さだと、どちらが主か分からない */
  subtle?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? subtle
            ? 'border-[var(--palace)] text-[var(--palace)]'
            : 'border-transparent text-white'
          : 'border-border text-muted-foreground hover:bg-muted'
      }`}
      style={active && !subtle ? { backgroundColor: 'var(--palace)' } : undefined}
    >
      {children}
    </button>
  )
}

/**
 * 種別の意味。
 *
 * 称号・勲章・宝物・表彰は似ているが役割が違う。毎回説明を並べると邪魔なので、
 * 押したときだけ右パネルで出す。今後、種類が増えてもここに足せる。
 */
function RewardKindsHelp() {
  const panel = usePanelForm(REWARD_KINDS_PANEL_KEY, '記名板について')

  return (
    <>
      <button
        type="button"
        onClick={panel.open}
        aria-expanded={panel.isOpen}
        aria-label="記名板について"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle size={16} />
      </button>

      <PanelSlotContent sectionKey={REWARD_KINDS_PANEL_KEY}>
        {/* まず**この板が何か**を書く。種類の説明から始めていたので、
            「持ち物の一覧」なのか「見せる場所」なのかが分からないままだった。
            ここで決めたものは他の画面にも出る。**それを知らないと、
            星を入れる意味が「この板の飾り」で終わる** */}
        <div className="mb-4 space-y-2 text-sm">
          <p>
            記名板は、<strong className="font-medium">いま何を名乗り、何を掲げているか</strong>を出す板です。
            持っているもの全部ではなく、<strong className="font-medium">自分で選んだものだけ</strong>が並びます。
          </p>
          <p className="text-muted-foreground">
            選ぶのは下の「獲得物」から。札の星を押すと、ここに載ります。
            称号は1つ、勲章は3つまでのように、種類ごとに数が決まっています。
          </p>
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground">
            ここで選んだものは、<strong className="font-medium text-foreground">エントランスの「宮殿の主人」</strong>にも出ます。
            この板だけの飾りではなく、<strong className="font-medium text-foreground">名乗りそのもの</strong>を決める場所です。
          </p>
        </div>

        {/* 見出しは dl の外へ出す。dl の直下に置けるのは dt / dd / div だけで、
            p を入れるとブラウザが勝手に閉じ、hydration が食い違う */}
        <p className="mb-3 border-t border-border pt-4 text-sm font-medium">獲得物の種類</p>

        <dl className="space-y-4 text-sm">
          {REWARD_KIND_HELP.map((entry) => (
            <div key={entry.label} className="space-y-1">
              <dt className="flex items-center gap-2 font-medium">
                <span style={{ color: 'var(--palace)' }}>{entry.icon}</span>
                {entry.label}
                <span className="text-xs text-muted-foreground">{entry.verb}</span>
              </dt>
              <dd className="text-muted-foreground">{entry.description}</dd>
            </div>
          ))}
          <div className="space-y-1 border-t border-border pt-3">
            <dt className="font-medium">レア度</dt>
            <dd className="text-muted-foreground">印の数が多いほど希少です（1〜9）。色も段ごとに変わります。</dd>
          </div>
        </dl>
      </PanelSlotContent>
    </>
  )
}

const REWARD_KINDS_PANEL_KEY = 'achievement-reward-kinds'


const KIND_LABELS: Record<RewardKind, string> = {
  title: '称号',
  medal: '勲章',
  treasure: '宝物',
  honor: '表彰',
}

function SummaryStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {value.toLocaleString()}
        {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
      </dd>
    </div>
  )
}
