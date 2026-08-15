'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CardImage } from '@/components/ui/card-image'
import { HelpPopover } from '@/components/ui/help-popover'
import { rewardKindHelp } from '@/lib/reward-kinds'
import { useAuthStore } from '@/stores/auth'
import { tierLabel } from '@/lib/billing'
import { displayNameOf } from '@/lib/display-name'
import { getAchievementSummary, type AchievementSummary, type RewardKind } from '@/lib/api/achievements'
import { getSettings } from '@/lib/api/settings'

/**
 * 「宮殿の主人」。生成資産（クレジット）の隣に並べる、本人のステータス面。
 *
 * 名乗っている称号と掲げている勲章は、栄誉の間で選んだものがそのまま出る。
 * 選ぶ場所と出る場所が違うと、選んだ意味が伝わらない。
 *
 * 読むのは軽いほう（summary）。全体を読むと実績の数え直しまで走り、
 * 関係のないこの画面がその重さを抱えることになる。
 */
export function PalaceLordCard({ tier }: { tier: string | null }) {
  const user = useAuthStore((s) => s.user)
  const [honors, setHonors] = useState<AchievementSummary | null>(null)
  const [palaceName, setPalaceName] = useState<string | null>(null)

  useEffect(() => {
    getAchievementSummary()
      .then(setHonors)
      .catch(() => {})
    getSettings()
      .then((s) => setPalaceName(s.palace_name))
      .catch(() => {})
  }, [])

  // 勲章は名前の右に絵だけで出す（項目行に混ぜると、増えるたびに縦へ伸びる）
  const medals = honors?.showcase?.medal ?? []
  // 上の行に置くものがあるか（称号か勲章）。無ければ行ごと出さない
  const hasTopRow = Boolean(honors?.title) || medals.length > 0
  const displayName = displayNameOf(user)
  const avatar = user?.avatar_thumb_url ?? user?.avatar_url ?? null
  // 入居日＝アカウントを開いた日。取得前でも行の高さが変わらないよう「—」を置く
  const movedInOn = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <section className="flex flex-col space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">宮殿の主人</h2>
      {/*
        札そのものはリンクにしない。**中に釦と別の行き先があるため。**
        全体を包んでいたころは、「?」を押しても獲得物の絵を押しても、
        ぜんぶアカウントの設定へ飛んでいた。
        行き先は、それを押した人が期待するものに分ける。
      */}
      <Card className="h-full">
        <CardContent className="space-y-4">
          {/* 宮殿の名前の行だけがアカウントへの入口。
              「自分の宮殿」と言いながら名無しだと、ただの保管庫に見える */}
          <Link
            href="/account"
            aria-label="アカウントの設定を見る"
            className="group flex items-center justify-between rounded-lg transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
          >
            <p className="flex items-center gap-2 truncate text-sm text-muted-foreground group-hover:text-foreground">
              <Crown size={18} className="shrink-0" style={{ color: 'var(--palace)' }} />
              {palaceName?.trim() || `${displayName}の宮殿`}
            </p>
            <ChevronRight
              size={18}
              className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </Link>

          <div className="flex items-center gap-3">
            <CardImage
              src={avatar}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full border border-border"
              fallback={<Crown size={20} className="text-muted-foreground/60" />}
            />
            {/*
              2行2列で組む。左が名乗り（称号・名前）、右が勲章。

              **行を格子で揃える。** 見出しは称号の行、絵は名前の行にぴたりと並ぶ。
              入れ子の縦積みだと、左右の文字の大きさが違うぶん行がずれる
              （称号は text-xs、名前は text-lg）。
            */}
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4">
              {/* 称号は名前の上に小さく。名前と同じ大きさで横に並べると、
                  どちらが本人の名前なのか分からなくなる */}
              {/* 称号は鉤括弧で囲む。**与えられた名前**なので、地の文と同じ見た目だと
                  本人が入力した文字列と区別がつかない（記名板と同じ扱いに揃える）。
                  絵は出さない。ここは名乗りであって、品物を見せる場ではない
                  （品物としての姿は栄誉の間で見る） */}
              {/* 1行目は、称号か勲章のどちらかがあるときだけ置く。
                  空の行を残すと、何も持っていない人の札にだけ余白が空く */}
              {hasTopRow && (
                <p
                  className="col-start-1 row-start-1 flex min-w-0 items-center gap-1 text-xs"
                  style={{ color: 'var(--palace)' }}
                >
                  {honors?.title && (
                    <>
                      <span className="truncate">「{honors.title.name}」</span>
                      {/* 手に入れた人ほど「これは何か」を知りたい。
                          栄誉の間の ? と同じ説明を、ここからも開けるようにする */}
                      <RewardKindHelpButton kind="title" />
                    </>
                  )}
                </p>
              )}
              {medals.length > 0 && (
                <p className="col-start-2 row-start-1 flex shrink-0 items-center gap-1 border-l border-border pl-3 text-[11px] text-muted-foreground">
                  勲章
                  <RewardKindHelpButton kind="medal" />
                </p>
              )}

              <p className="col-start-1 row-start-2 truncate text-lg font-semibold">{displayName}</p>
              {/* 勲章は名前から離す。くっついていると、名前の続きに見える。
                  区切り線は上下の枡で続くので、1本の線に見える */}
              {medals.length > 0 && (
                <span className="col-start-2 row-start-2 flex shrink-0 items-center gap-1 border-l border-border pl-3">
                  {medals.map((reward) =>
                    reward.image_url ? (
                      <RewardLink key={reward.key} name={reward.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={reward.image_url} alt={reward.name} width={20} height={20} loading="lazy" />
                      </RewardLink>
                    ) : null
                  )}
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">位</dt>
              <dd className="font-medium">{tier ? tierLabel(tier) : '—'}</dd>
            </div>
            {/* 入居日は「位」と同じ並びに独立して置く。名前の下に埋めると、
                本人を指す情報と宮殿の情報が混ざる */}
            <div>
              <dt className="text-xs text-muted-foreground">入居</dt>
              <dd className="font-medium">{movedInOn}</dd>
            </div>
            {/* 称号が無い人には、次に取れるものを出す */}
            {!honors?.title && honors?.next_title && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">称号</dt>
                <dd className="text-xs text-muted-foreground">
                  {honors.next_title.condition ?? 'もう少し進める'}と「{honors.next_title.name}」
                </dd>
              </div>
            )}
            {/* 記名板で星を入れたものを、種別ごとに出す */}
            {SHOWCASE_KINDS.map(([kind, label]) => {
              const rows = honors?.showcase?.[kind] ?? []
              if (rows.length === 0) return null
              return (
                <div key={kind} className="col-span-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {rows.map((reward) => (
                      <RewardLink key={reward.key} name={reward.name}>
                        {reward.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={reward.image_url} alt={reward.name} width={22} height={22} loading="lazy" />
                        ) : (
                          <span className="text-xs">{reward.name}</span>
                        )}
                      </RewardLink>
                    ))}
                  </dd>
                </div>
              )
            })}
          </dl>
      </CardContent>
      </Card>
    </section>
  )
}

// 記名板に出す種別と見出し。称号は名前の上に出すので、ここには含めない
const SHOWCASE_KINDS: [RewardKind, string][] = [
  // 勲章は名前の右に絵だけで出すので、ここには含めない
  ['treasure', '宝物'],
  ['honor', '表彰'],
]

/**
 * 獲得物ひとつ。押すと栄誉の間へ行く。
 *
 * 絵を押した人が見たいのは**その品物**であって、アカウントの設定ではない。
 * 名前は title で添える（絵だけでは何か分からない）。
 */
function RewardLink({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <Link
      href="/achievements"
      title={name}
      aria-label={`${name}（栄誉の間で見る）`}
      className="inline-flex rounded transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
    >
      {children}
    </Link>
  )
}

/**
 * 種類の説明を開く小さな釦。
 *
 * 説明そのものは `lib/reward-kinds` が持つ（栄誉の間の `?` と同じもの）。
 * ここで文言を書くと、同じ語の説明が画面ごとに食い違う。
 */
function RewardKindHelpButton({ kind }: { kind: 'title' | 'medal' | 'treasure' | 'honor' }) {
  const help = rewardKindHelp(kind)
  if (!help) return null

  return (
    <HelpPopover label={`${help.label}について`} title={`${help.label}（${help.verb}）`}>
      <p className="text-sm">{help.description}</p>
    </HelpPopover>
  )
}
