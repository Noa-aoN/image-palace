import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Layers, HelpCircle, Gamepad2, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'スタディ' }

type StudyMode = {
  href?: string
  icon: ReactNode
  label: string
  description: string
  comingSoon?: boolean
}

const STUDY_MODES: StudyMode[] = [
  {
    href: '/study/practice',
    icon: <Layers size={20} />,
    label: 'プラクティス',
    description: 'カードを見返しながら、低負担で練習します。',
  },
  {
    href: '/study/quiz',
    icon: <HelpCircle size={20} />,
    label: 'クイズ',
    description: '選んだカードやボックスから問題を作って確認します。',
  },
  {
    href: '/study/game',
    icon: <Gamepad2 size={20} />,
    label: 'プレイ',
    description: 'カルタや神経衰弱など、ゲームで楽しみながら反復できる学習モードです。',
  },
  {
    href: '/study/record',
    icon: <BarChart3 size={20} />,
    label: 'レコード',
    description: '学習履歴や正答率を確認します。',
  },
]

export default function StudyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold">スタディ</h1>
      <p className="mt-2 text-muted-foreground">
        保存したカードやボックスを使って、記憶を定着させます。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {STUDY_MODES.map((mode) =>
          mode.comingSoon || !mode.href ? (
            <Card key={mode.label} className="h-full border-dashed bg-card/60" aria-disabled>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span style={{ color: 'var(--palace)' }}>{mode.icon}</span>
                    {mode.label}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">準備中</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{mode.description}</p>
              </CardContent>
            </Card>
          ) : (
            <Link
              key={mode.label}
              href={mode.href}
              aria-label={mode.label}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
            >
              <Card className="h-full cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span style={{ color: 'var(--palace)' }}>{mode.icon}</span>
                      {mode.label}
                    </span>
                    <ChevronRight
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--palace)' }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{mode.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        )}
      </div>
    </div>
  )
}
