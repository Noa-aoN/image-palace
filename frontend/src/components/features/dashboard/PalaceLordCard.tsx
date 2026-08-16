'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CardImage } from '@/components/ui/card-image'
import { ImageLightbox } from '@/components/ui/image-lightbox'
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
  const [avatarOpen, setAvatarOpen] = useState(false)

  useEffect(() => {
    getAchievementSummary()
      .then(setHonors)
      .catch(() => {})
    getSettings()
      .then((s) => setPalaceName(s.palace_name))
      .catch(() => {})
  }, [])

  // 勲章と宝物は項目行に絵で出す。掲げていなければ「—」を置いて、
  // 持っていない人の札でも行の高さが変わらないようにする
  const medals = honors?.showcase?.medal ?? []
  const treasures = honors?.showcase?.treasure ?? []
  // 名前の上に置くものがあるか（いまは称号だけ）。無ければ行ごと出さない
  const hasTopRow = Boolean(honors?.title)
  const displayName = displayNameOf(user)
  const avatar = user?.avatar_thumb_url ?? user?.avatar_url ?? null
  // 入居日＝アカウントを開いた日。取得前でも行の高さが変わらないよう「—」を置く
  const movedInOn = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <section className="flex flex-col space-y-3">
      <h2 className="text-base font-semibold">宮殿の主人</h2>
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
            {/*
              絵があれば押して大きく見る。無ければ、決めに行く場所へそのまま送る。

              **どちらの状態でも押せる**ようにするのが要。絵が無いときに
              押しても何も起きないと、ここが設定の入口だと分からない。
            */}
            {avatar ? (
              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                aria-label="自分の絵を大きく見る"
                className="shrink-0 rounded-full transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
              >
                <CardImage
                  src={avatar}
                  alt=""
                  className="h-14 w-14 rounded-full border border-border"
                  fallback={<Crown size={20} className="text-muted-foreground/60" />}
                />
              </button>
            ) : (
              <Link
                href={AVATAR_SETTINGS_HREF}
                aria-label="自分の絵を決める"
                title="自分の絵を決める"
                className="shrink-0 rounded-full transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
              >
                <CardImage
                  src={null}
                  alt=""
                  className="h-14 w-14 rounded-full border border-dashed border-border"
                  fallback={<Crown size={20} className="text-muted-foreground/60" />}
                />
              </Link>
            )}
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
                  className="col-start-1 row-start-1 flex min-w-0 items-center gap-1 text-[13px]"
                  style={{ color: 'var(--palace)' }}
                >
                  {honors?.title && (
                    // 勲章の絵と同じ行き先にする。名乗っているものを押した人が
                    // 見たいのは**それが何か**であって、この札の説明ではない
                    // 鉤括弧は外す。**すぐ下に表示名が来る並び**なので、
                    // 引いて見せなくても、上が名乗り・下が本人の名前だと読み取れる。
                    // 代わりに少し太くして、地の文との差は保つ
                    <Link
                      href="/achievements"
                      title={honors.title.name}
                      aria-label={`称号「${honors.title.name}」（栄誉の間で見る）`}
                      className="min-w-0 truncate rounded font-medium transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
                    >
                      {honors.title.name}
                    </Link>
                  )}
                </p>
              )}
              {/* 表示名・プラン名・残高は、**同じ大きさ**に揃える。
                  隣り合う2枚の札で見出しの大きさが違うと、どちらかが格上に見える */}
              <p className="col-start-1 row-start-2 truncate text-lg font-semibold">{displayName}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {/* 並びは「集めたもの」から「素性」へ。
                上の段に勲章と宝物、下の段に入居日と位を置く。
                獲得物は絵で出るので目を引く。**先に見えるものを上に**置き、
                日付や段のような読む情報は下にまとめる */}
            <div>
              <dt className="text-xs text-muted-foreground">勲章</dt>
              <dd className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {medals.length > 0 ? (
                  medals.map((reward) => (
                    <RewardLink key={reward.key} name={reward.name}>
                      {reward.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={reward.image_url} alt={reward.name} width={22} height={22} loading="lazy" />
                      ) : (
                        <span className="text-xs">{reward.name}</span>
                      )}
                    </RewardLink>
                  ))
                ) : (
                  <span className="font-medium">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">宝物</dt>
              <dd className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {treasures.length > 0 ? (
                  treasures.map((reward) => (
                    <RewardLink key={reward.key} name={reward.name}>
                      {reward.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={reward.image_url} alt={reward.name} width={22} height={22} loading="lazy" />
                      ) : (
                        <span className="text-xs">{reward.name}</span>
                      )}
                    </RewardLink>
                  ))
                ) : (
                  <span className="font-medium">—</span>
                )}
              </dd>
            </div>
            {/* 入居日と位は、本人ではなく**この宮殿**を指す情報。
                名前の下に埋めると、本人を指す情報と混ざる */}
            <div>
              <dt className="text-xs text-muted-foreground">入居日</dt>
              <dd className="font-medium">{movedInOn}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">位</dt>
              <dd className="font-medium">{tier ? tierLabel(tier) : '—'}</dd>
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

      <ImageLightbox
        url={avatar}
        alt="自分の絵"
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        action={
          <Link href={AVATAR_SETTINGS_HREF} className="underline underline-offset-2 hover:text-white">
            編集する
          </Link>
        }
      />
    </section>
  )
}

// 自分の絵を決める場所。**基本プロフィールの枠ごと指す**ので、
// 画面の中の並びが変わっても行き先は変わらない
const AVATAR_SETTINGS_HREF = '/account#basic'

// 記名板に出す種別と見出し。称号は名前の上に、勲章は名前の右に出すので含めない。
// 並びは栄誉の間と同じ（称号 → 勲章 → 表彰 → 宝物）。
// **同じものが2つの画面で違う順に並ぶと、どちらかが間違って見える**
const SHOWCASE_KINDS: [RewardKind, string][] = [
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

