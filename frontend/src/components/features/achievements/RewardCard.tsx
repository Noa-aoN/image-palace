'use client'

import { Crown, Lock, Medal, Award, Gem, Star, HelpCircle } from 'lucide-react'
import type { RewardKind, RewardRow } from '@/lib/api/achievements'
import { rarityStyle } from './rarity'

/**
 * 獲得物1つぶんの札。
 *
 * 状態を3つに描き分ける。並べたときに、持っているもの・あと少しのもの・遠いものが
 * ひと目で分かることが要点。
 *
 *   獲得済み … 色そのまま、レア度の枠
 *   もうすぐ … 進捗バー、枠を少し強める
 *   未獲得   … 灰色＋薄く＋鍵
 *
 * 光彩は上の段（瑠璃・星・神聖・ムーサ）だけに付ける。全部光っていると、
 * どれが特別なのか分からない。
 */
export function RewardCard({
  reward,
  onOpen,
  onToggleFeatured,
  busy,
  children,
}: {
  reward: RewardRow
  onOpen: () => void
  /** 代表として掲げる／下ろす。掲げられる獲得物のときだけ効く */
  onToggleFeatured: () => void
  busy?: boolean
  /** 名乗るなど、残りの操作 */
  children?: React.ReactNode
}) {
  const style = rarityStyle(reward.rarity_tier)
  const ratio =
    reward.target && reward.target > 0 ? Math.min(1, (reward.progress ?? 0) / reward.target) : null
  const almost = !reward.owned && ratio !== null && ratio >= 0.5

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-xl border p-3 text-center transition-shadow ${
        reward.owned ? `bg-card ${style.frame}` : almost ? 'border-[var(--palace)]/40 bg-card' : 'border-dashed border-border/60 bg-card/40'
      }`}
      style={reward.owned && style.glow ? { boxShadow: style.glow } : undefined}
    >
      {/* 掲げるはボタンではなく星にする。札ごとにボタンが積み上がると、
          絵より操作のほうが目立ってしまう。掲げているものは常に光らせる */}
      {reward.owned && reward.featurable && (
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={busy}
          aria-pressed={reward.featured}
          aria-label={reward.featured ? `${reward.name}を下ろす` : `${reward.name}を掲げる`}
          title={reward.featured ? '掲げている' : '掲げる'}
          className={`absolute left-1.5 top-1.5 transition-opacity disabled:opacity-40 ${
            reward.featured
              ? 'text-[var(--palace)] opacity-100'
              : 'text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100'
          }`}
        >
          <Star size={15} fill={reward.featured ? 'currentColor' : 'none'} />
        </button>
      )}

      {/* 詳しい条件は「?」から。札の上に全部書くと縦に伸びて、並べて眺められなくなる */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${reward.name}の獲得条件`}
        className="absolute right-1.5 top-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <HelpCircle size={14} />
      </button>

      {/* 画像はホバーで名前と条件を出す。狭い画面では押して詳細を開く */}
      <button
        type="button"
        onClick={onOpen}
        className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
        aria-label={`${reward.name}の詳細`}
      >
        <RewardArt reward={reward} size={56} />
        <span className="pointer-events-none absolute inset-x-[-1rem] bottom-full mb-1 hidden rounded-md bg-foreground px-2 py-1 text-[11px] leading-snug text-background shadow-md group-hover:block">
          {reward.name}
          {!reward.owned && reward.condition && <span className="block opacity-80">{reward.condition}</span>}
        </span>
      </button>

      <div className="space-y-1">
        <p className={`text-sm font-medium ${reward.owned ? '' : 'text-muted-foreground'}`}>{reward.name}</p>
        <RarityMarks level={reward.rarity_level} tierClass={style.text} dim={!reward.owned} />
      </div>

      {reward.description && (
        <p className="text-[11px] leading-snug text-muted-foreground">{reward.description}</p>
      )}

      {/* もうすぐ取れるものだけ進捗を出す。全部に出すと、遠いものまで急かして見える */}
      {almost && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(ratio ?? 0) * 100}%`, backgroundColor: 'var(--palace)' }}
            />
          </div>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {reward.progress} / {reward.target}
          </p>
        </div>
      )}

      {children}
    </div>
  )
}

// 画像を入れるまでは種類ごとの絵柄で描く（あとから差し替えられる）
const KIND_ICONS: Record<RewardKind, typeof Crown> = {
  title: Crown,
  medal: Medal,
  treasure: Gem,
  honor: Award,
}

export function RewardArt({ reward, size }: { reward: RewardRow; size: number }) {
  if (reward.image_url) {
    return (
      <span className="relative inline-flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={reward.image_url}
          alt={reward.name}
          width={size}
          height={size}
          className={reward.owned ? '' : 'opacity-35 grayscale'}
          loading="lazy"
        />
        {!reward.owned && (
          <Lock
            size={Math.round(size * 0.3)}
            className="absolute bottom-0 right-0 text-muted-foreground"
            aria-hidden
          />
        )}
      </span>
    )
  }

  const Icon = KIND_ICONS[reward.kind]
  return (
    <span className="relative inline-flex" style={{ color: reward.owned ? 'var(--palace)' : undefined }}>
      <Icon size={size} className={reward.owned ? '' : 'text-muted-foreground/35'} />
      {!reward.owned && (
        <Lock size={Math.round(size * 0.3)} className="absolute bottom-0 right-0 text-muted-foreground" aria-hidden />
      )}
    </span>
  )
}

/**
 * レア度の印。数が多いほど上。
 *
 * 名前（石・青銅・瑠璃…）は出さない。9つの名前を覚えないと上下が分からないうえ、
 * 札のなかで場所を取る。**数と色**だけで足りる。
 * 未獲得のものは印も落として、獲得済みと見分けが付くようにする。
 */
export function RarityMarks({
  level,
  tierClass,
  dim,
}: {
  level: number
  tierClass: string
  dim?: boolean
}) {
  return (
    <p
      className={`flex items-center justify-center ${dim ? 'opacity-50' : ''}`}
      aria-label={`レア度 ${level}`}
    >
      {Array.from({ length: level }).map((_, i) => (
        <Star key={i} size={9} className={tierClass} fill="currentColor" strokeWidth={0} aria-hidden />
      ))}
    </p>
  )
}
