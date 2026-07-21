'use client'

import { Trophy, Medal, Crown, Activity, Globe } from 'lucide-react'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'

type TabKey = 'achievement' | 'badge' | 'title' | 'activity' | 'public'

const sections: CategorySection<TabKey>[] = [
  {
    key: 'achievement',
    label: '実績',
    icon: <Trophy size={16} />,
    content: (
      <ComingSoon
        description="カード作成数や継続日数などの達成状況を順次対応予定です。"
        items={['達成済みの実績', '進行中の実績', '次に目指す実績']}
      />
    ),
  },
  {
    key: 'badge',
    label: 'バッジ',
    icon: <Medal size={16} />,
    content: (
      <ComingSoon
        description="獲得したバッジのボックス表示は順次対応予定です。"
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
        description="獲得した称号の選択・表示は順次対応予定です。"
        items={['獲得した称号', '表示する称号の選択']}
      />
    ),
  },
  {
    key: 'activity',
    label: '活動記録',
    icon: <Activity size={16} />,
    content: (
      <ComingSoon
        description="日々の学習アクティビティの記録は順次対応予定です。"
        items={['学習カレンダー', '連続記録', '月間サマリー']}
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
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Trophy size={22} style={{ color: 'var(--palace)' }} />
          トロフィー
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          学習の積み重ねを実績・バッジ・称号として可視化します。
        </p>
      </div>

      <CategorySections sections={sections} ariaLabel="トロフィーカテゴリ" />
    </div>
  )
}
