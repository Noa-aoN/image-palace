import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StartLink } from '@/components/features/shared/StartLink'
import { NAV_SECTIONS, GLOBAL_ACTIONS } from '@/components/features/layout/nav-items'
import { GUIDE_SECTIONS, getGuideSection, STEPS, FEATURE_GROUPS, FAQ, GLOSSARY, USE_CASES, type GuideSlug } from '@/lib/guide/sections'
import { guideJsonLd, breadcrumbJsonLd } from '@/lib/seo/structured-data'
import { shareImage } from '@/lib/seo/share-image'

export function generateStaticParams() {
  return GUIDE_SECTIONS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const section = getGuideSection(slug)
  if (!section) return { title: '使い方' }

  return {
    title: `${section.title} — 使い方`,
    description: section.excerpt,
    alternates: { canonical: `/guide/${section.slug}` },
    openGraph: {
      type: 'article',
      title: section.title,
      description: section.excerpt,
      url: `/guide/${section.slug}`,
      images: [shareImage('guide')],
    },
    twitter: { card: 'summary_large_image', images: [shareImage('guide')] },
  }
}

// --- セクションごとの本文 ---

function StepsContent() {
  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-4 rounded-xl border border-border bg-card p-4">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--palace)' }}
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">{step.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function FeaturesContent() {
  return (
    <div className="space-y-8">
      {FEATURE_GROUPS.map((group) => {
        const Icon = group.icon
        return (
          <section key={group.theme}>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Icon size={20} style={{ color: 'var(--palace)' }} />
              {group.theme}
            </h2>
            <dl className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {group.items.map((it) => (
                <div key={it.name} className="px-4 py-3 sm:flex sm:gap-4">
                  <dt className="font-medium sm:w-40 sm:shrink-0">{it.name}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground sm:mt-0">{it.desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}

function FaqContent() {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {FAQ.map((item) => (
        <details key={item.q} className="group px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
            <span>{item.q}</span>
            <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">
              ＋
            </span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  )
}

function GlossaryContent() {
  return (
    <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {GLOSSARY.map((g) => (
        <div key={g.term} className="px-4 py-3">
          <dt className="font-semibold">{g.term}</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{g.desc}</dd>
        </div>
      ))}
    </dl>
  )
}

// サイトマップ上位ノードの補足説明（メタファー的で分かりにくい入口だけを対象にする）。
// 子ノード（作成/一覧/学習モード等）はラベル自体が説明的なので付けない。
const NODE_DESC: Record<string, string> = {
  '/search': 'カード・ボックスなどをまとめて検索',
  '/tags': 'タグでカードを分類・絞り込み',
  '/index': '登録した内容の索引',
  '/entrance': 'ログイン後の入口となるホーム',
  '/atelier': '作る — カードやボックスなどの作成ハブ',
  '/library': 'ためる — 作ったものの一覧',
  '/study': '学ぶ — 復習・練習で記憶を定着',
  '/myroom': 'アカウント・支払い・設定',
  '/delphi': '神託を受け取る場所（言葉をもらう・コードを引き換える）',
  '/agora': 'コンテンツを共有・販売できるマーケットプレイス',
  '/stadion': 'ゲーム形式で競い合える場所',
  '/board': '運営から届くもの（お知らせ・使い方・コラム）',
  '/news': '運営からの連絡・更新情報',
  '/guide': 'このガイド（使い方・用語・FAQ）',
  '/blog': '記憶・学習・認知科学のコラム',
  '/admin': '運営の執務室（運営メンバーのみ）',
}

// ツリーの1ノード（アイコン＋ラベル）。href が無い見出しノードは非リンクで表示する。
// desc があればラベルの右に補足説明を添える（上位ノードのみ）。
function TreeNode({
  href,
  icon,
  label,
  child,
  desc,
}: {
  href?: string
  icon: React.ReactNode
  label: string
  child?: boolean
  desc?: string
}) {
  const inner = (
    <span className="flex items-center gap-2">
      <span className="shrink-0 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
        {icon}
      </span>
      <span className={child ? 'text-muted-foreground' : 'font-medium'}>{label}</span>
      {desc && <span className="text-xs text-muted-foreground">— {desc}</span>}
    </span>
  )
  if (!href) return <span className="inline-flex py-0.5 text-sm">{inner}</span>
  return (
    <Link href={href} className="inline-flex py-0.5 text-sm transition-colors hover:text-[var(--palace)]">
      {inner}
    </Link>
  )
}

function SitemapContent() {
  // 横断アクションも同じツリーに載せるため、擬似セクションとして先頭に並べる。
  const groups = [{ key: 'global', title: '横断', items: GLOBAL_ACTIONS }, ...NAV_SECTIONS]
  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-5">
      {groups.map((group) => (
        <div key={group.key}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h2>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => (
              <li key={item.label}>
                <TreeNode href={item.href} icon={item.icon} label={item.label} desc={item.href ? NODE_DESC[item.href] : undefined} />
                {item.children && (
                  <ul className="ml-[9px] mt-0.5 space-y-0.5 border-l border-border pl-3.5">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <TreeNode href={child.href} icon={child.icon} label={child.label} child />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * おすすめ使用例。
 *
 * 「何ができるか」ではなく**何のために使うか**を並べる。
 * 読む順は 一言 → こんな人に → 作るカード → 効く機能 → 完成イメージ。
 * **説明は短く。** 長い文は読まれず、読まれなければ無いのと同じ。
 */
function UseCasesContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        いま出来ることだけで書いています。気になったものから、そのまま真似してください。
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {USE_CASES.map((useCase) => (
          <article key={useCase.title} className="flex flex-col rounded-xl border border-border bg-card p-4">
            <h2 className="font-medium leading-snug">{useCase.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{useCase.summary}</p>

            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">こんな人に</dt>
                <dd>{useCase.forWhom}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">どんなカードを作るか</dt>
                <dd>{useCase.cards}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">ここが役立つ</dt>
                <dd>
                  <ul className="mt-0.5 flex flex-wrap gap-1.5">
                    {useCase.features.map((feature) => (
                      <li
                        key={feature}
                        className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>

            {/* 出来上がった状態を最後に置く。ここだけ読んでも用途が分かるように */}
            <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">{useCase.result}</p>
          </article>
        ))}
      </div>

      {/* 行き先は1つだけ。増やすと、どれを押せばよいか考えさせる */}
      <div className="pt-2">
        {/* 読みに来た人が、押した先で追い返されないように */}
        <StartLink href="/items/new">
          <Button>この使い方で始める</Button>
        </StartLink>
      </div>
    </div>
  )
}

const CONTENT: Record<GuideSlug, () => React.ReactElement> = {
  'getting-started': StepsContent,
  'use-cases': UseCasesContent,
  features: FeaturesContent,
  faq: FaqContent,
  glossary: GlossaryContent,
  sitemap: SitemapContent,
}

export default async function GuideSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const section = getGuideSection(slug)
  if (!section) notFound()

  const Icon = section.icon
  const Content = CONTENT[section.slug]

  // 静的な定数のみ埋め込む（利用者の入力は入らないため XSS の経路にならない）
  const jsonLd = [
    guideJsonLd(section),
    breadcrumbJsonLd([
      { name: 'ホーム', path: '/' },
      { name: '使い方', path: '/guide' },
      { name: section.title, path: `/guide/${section.slug}` },
    ]),
  ]

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 外枠は全幅、本文は読みやすい幅に制限 */}
      <div className="mx-auto max-w-2xl">
      <Link
        href="/guide"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        使い方一覧へ
      </Link>

      <header className="mt-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Icon size={26} style={{ color: 'var(--palace)' }} />
          {section.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{section.excerpt}</p>
      </header>

      <div className="mt-8">
        <Content />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/guide">
          <Button variant="outline">使い方一覧へ戻る</Button>
        </Link>
      </div>
      </div>
    </div>
  )
}
