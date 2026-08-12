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
  onToggleStar,
  busy,
  imageOnly,
}: {
  reward: RewardRow
  onOpen: () => void
  /** 星の入り切り。称号なら名乗る、勲章なら掲げる、宝物なら飾る */
  onToggleStar: () => void
  busy?: boolean
  /** 絵だけ並べる。名前や説明はホバー（狭い画面では押して詳細）で見る */
  imageOnly?: boolean
}) {
  const style = rarityStyle(reward.rarity_tier)
  const verb = STAR_VERB[reward.kind]
  const ratio =
    reward.target && reward.target > 0 ? Math.min(1, (reward.progress ?? 0) / reward.target) : null
  const almost = !reward.owned && ratio !== null && ratio >= 0.5

  return (
    <div
      className={`group relative flex flex-col gap-1.5 rounded-xl border p-2.5 text-center transition-shadow ${
        reward.owned ? `bg-card ${style.frame}` : almost ? 'border-[var(--palace)]/40 bg-card' : 'border-dashed border-border/60 bg-card/40'
      }`}
      style={reward.owned && style.glow ? { boxShadow: style.glow } : undefined}
    >
      {/* 操作は星ひとつ。称号なら名乗る、勲章なら掲げる、宝物なら飾る、と
          結果だけが変わる。種別ごとにボタンを並べると、絵より操作が目立ってしまう。
          入れているものは常に光らせる（ホバーしないと分からない状態にしない） */}
      {reward.owned && (
        <button
          type="button"
          onClick={onToggleStar}
          disabled={busy}
          aria-pressed={reward.starred}
          aria-label={`${reward.name}を${reward.starred ? verb.on : verb.off}`}
          title={reward.starred ? verb.on : `${verb.off}（${verb.place}）`}
          className={`absolute left-1.5 top-1.5 z-10 transition-opacity disabled:opacity-40 ${
            reward.starred
              ? 'text-[var(--palace)] opacity-100'
              : 'text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100'
          }`}
        >
          <Star size={15} fill={reward.starred ? 'currentColor' : 'none'} />
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
        className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
        aria-label={`${reward.name}の詳細`}
      >
        <RewardArt reward={reward} size={52} />
        <span className="pointer-events-none absolute inset-x-[-1rem] bottom-full mb-1 hidden rounded-md bg-foreground px-2 py-1 text-[11px] leading-snug text-background shadow-md group-hover:block">
          {reward.name}
          {!reward.owned && reward.condition && <span className="block opacity-80">{reward.condition}</span>}
        </span>
      </button>

      {!imageOnly && (
        <>
          <div className="space-y-1">
            <p className={`text-[13px] font-medium leading-tight ${reward.owned ? '' : 'text-muted-foreground'}`}>
            {reward.name}
          </p>
            <RarityMarks level={reward.rarity_level} tierClass={style.text} dim={!reward.owned} />
          </div>

        </>
      )}

      {/* もうすぐ取れるものだけ進捗を出す。全部に出すと、遠いものまで急かして見える */}
      {almost && !imageOnly && (
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

    </div>
  )
}


/** 星を入れたときに何が起きるか。種別で言い方が変わる */
export const STAR_VERB: Record<RewardKind, { on: string; off: string; place: string }> = {
  title: { on: '名乗っている', off: '名乗る', place: 'ステータスに出ます' },
  medal: { on: '掲げている', off: '掲げる', place: 'ステータスに並びます' },
  treasure: { on: '飾っている', off: '飾る', place: 'マイルームに飾ります' },
  honor: { on: '見せている', off: '見せる', place: 'プロフィールに出ます' },
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
