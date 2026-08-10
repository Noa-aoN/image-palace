'use client'

import { Trophy, Medal, Crown, Activity, Globe } from 'lucide-react'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { AchievementList } from '@/components/features/trophy/AchievementList'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'

type TabKey = 'achievement' | 'badge' | 'title' | 'activity' | 'public'

const sections: CategorySection<TabKey>[] = [
  {
    key: 'achievement',
    label: '実績',
    icon: <Trophy size={16} />,
    // 実績・メダル・称号は同じ計算から出るので、1つの面にまとめて出す。
    // タブで分けると、金メダルの数と称号の関係が読み取れなくなる
    content: <AchievementList />,
  },
  {
    key: 'badge',
    label: 'バッジ',
    icon: <Medal size={16} />,
    content: (
      <ComingSoon
        description="部門ごとのメダルは「実績」に出しています。持ち物として飾れるバッジは順次対応予定です。"
        items={['獲得バッジ', 'レアバッジ', '未獲得バッジ']}
      />
    ),
  },
  {
    key: 'title',
    label: '称号',
    icon: <Crown size={16} />,
    content: (
      <ComingSoon
        description="いまの称号は「実績」に出しています。付け替えや公開は順次対応予定です。"
        items={['称号の付け替え', 'プロフィールへの掲載']}
      />
    ),
  },
  {
    key: 'activity',
    label: '活動記録',
    icon: <Activity size={16} />,
    content: (
      <ComingSoon
        description="日ごとの学習量の振り返りは順次対応予定です。"
        items={['学習した日', '作った枚数', '続けた日数']}
      />
    ),
  },
  {
    key: 'public',
    label: '公開実績',
    icon: <Globe size={16} />,
    content: (
      <ComingSoon
        description="公開プロフィールに載せる実績の選択は順次対応予定です。"
        items={['公開する実績の選択', 'プロフィールへの掲載']}
      />
    ),
  },
]

export default function TrophyPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Trophy size={26} style={{ color: 'var(--palace)' }} />
          トロフィー
        </h1>
        <p className="mt-2 text-muted-foreground">
          学習の積み重ねを実績・バッジ・称号として可視化します。
        </p>
      </div>

      {/* ページ全体の段階は PageGate（app/layout）が見る。ここは中身だけ */}
      <CategorySections sections={sections} ariaLabel="トロフィーカテゴリ" />
    </div>
  )
}
