'use client'

import type { RewardPreview } from '@/lib/api/achievements'
import { rarityStyle } from './rarity'

/**
 * 実績・ミッションの右端に、もらえるものを控えめに出す。
 *
 * 「やること」ではなく「報酬への道」に見せる。何が貰えるか分からないと、やる気にならない。
 * まだ手に入れていないものは色を落とす（持っているものと見分けが付かないと、集めた実感が出ない）。
 */
export function RewardPreviews({ rewards, earned }: { rewards: RewardPreview[]; earned: boolean }) {
  if (rewards.length === 0) return null

  return (
    <ul className="flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
      {rewards.map((reward, index) => (
        <li key={reward.key ?? `credits-${index}`}>
          {reward.type === 'credits' ? (
            <span
              className={`rounded-full bg-muted/60 px-2 py-0.5 text-[11px] ${
                earned ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {reward.amount} cr
            </span>
          ) : (
            <span
              className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
              title={`${reward.name}（${reward.kind_label}）`}
            >
              {reward.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reward.image_url}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  className={earned ? '' : 'opacity-45 grayscale'}
                />
              ) : null}
              <span className={earned ? rarityStyle(reward.rarity_tier).text : undefined}>{reward.name}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
