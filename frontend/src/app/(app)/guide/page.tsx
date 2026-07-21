import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Layers, Images, RefreshCw, HelpCircle, BookMarked, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NAV_SECTIONS, GLOBAL_ACTIONS } from '@/components/features/layout/nav-items'

export const metadata: Metadata = { title: '使い方' }

// 用語集（サービス内の主な用語）
const GLOSSARY: { term: string; desc: string }[] = [
  { term: 'カード', desc: '単語や概念に、その意味を表すイメージを結びつけた学習の基本単位です。' },
  { term: 'イメージ（画像）', desc: 'カードの意味を表す、AIが自動生成する画像です。文字と一緒に記憶を助けます。' },
  { term: '生成枠（クレジット）', desc: '画像を生成できる残り回数です。無料枠は毎月100枚まで。翌月に回復します。' },
  { term: 'ボックス', desc: 'カードをテーマごとにまとめておく入れ物です。' },
  { term: 'キャンバス（フリーボード）', desc: 'カードを自由に配置し、線でつないで関係を可視化するボードです。' },
  { term: 'スペース', desc: '場所に配置して覚えるビューです。「記憶の宮殿」のように空間で記憶を整理します。' },
  { term: '接続線', desc: 'キャンバス上でカード同士をつなぐ線。矢印・ラベル・色で関係を表現できます。' },
  { term: 'レイヤー（重なり順）', desc: 'カードや接続線の前後の重なり順です。右クリックや一覧の並べ替えで調整できます。' },
  { term: '再生成', desc: '画像を作り直すことです。失敗したカードからの再生成は生成枠を消費しません。' },
  { term: 'エントランス', desc: 'ログイン後の入口となるホーム画面です。' },
  { term: 'アトリエ / ライブラリ / スタディ', desc: 'それぞれ「作る」「ためる（一覧）」「学ぶ（復習）」ための場所です。' },
]

// 使い方ガイド（ステップ）
const STEPS: { title: string; body: string }[] = [
  {
    title: 'カードをまとめて作る',
    body: '覚えたい単語や概念を入力してカードを作成します。改行・カンマ・読点で区切れば、一度に複数枚をまとめて登録できます。まずは10枚ほど試してみるのがおすすめです。',
  },
  {
    title: 'AIが画像を生成するのを待つ',
    body: 'カードごとに、その意味を表すイメージをAIが自動生成します。生成は順番に進み、完了したものから画像が表示されます（画面はそのままで自動更新されます）。同じ単語の画像は再利用されるため、待ち時間とコストを抑えています。',
  },
  {
    title: 'イメージで覚える・思い出す',
    body: 'カードの画像を眺めて、単語とイメージを結びつけて記憶します。詳細画面では左右の矢印で連続して見返せます。文字だけよりも、絵と一緒に覚えるほうが思い出しやすくなります。',
  },
  {
    title: 'フリーボードで関係を整理する',
    body: 'カードを自由に配置し、線でつないで関係を可視化できます。矢印・ラベル・色で意味づけし、重なり順（レイヤー）で見やすく整えられます。単語同士のつながりを「地図」のように育てていきましょう。',
  },
]

// よくある質問（FAQ）
const FAQ: { q: string; a: string }[] = [
  {
    q: '画像の生成にはどのくらい時間がかかりますか？',
    a: 'カード1枚あたり数十秒程度が目安です。混雑時や枚数が多いときは順番待ちで前後します。生成中も画面を離れて問題ありません。戻ってきたときに完成した画像が表示されます。',
  },
  {
    q: '画像がうまく生成できなかった（失敗した）ときは？',
    a: 'カードが「失敗」状態のときは、詳細画面から再生成できます。失敗からの再生成では生成枠（クレジット）は消費しません。何度か試しても不安定な場合は、単語の表記を少し変えると改善することがあります。',
  },
  {
    q: '同じ単語をもう一度作ると、生成枠を二重に消費しますか？',
    a: 'いいえ。同じ単語の画像はキャッシュされ、世界で一度だけ生成して再利用します。すでに生成済みの単語は、待ち時間もなくすぐに表示されます。',
  },
  {
    q: '無料でどのくらい使えますか？',
    a: '無料枠として毎月100枚まで画像を生成できます。上限に達した場合は翌月に回復します。より多く使いたい場合のプランは順次ご案内します。',
  },
  {
    q: 'フリーボードの接続線はどう編集しますか？',
    a: 'カードのふちに出る接続点からドラッグして線を引きます。線をクリックすると右パネルで色・太さ・線種・矢印・ラベルを編集できます。線の端点はドラッグで別のカードへ付け替えられ、折れ点を足して経路を整えることもできます。',
  },
  {
    q: 'カードやボードのデータは他の人に見えますか？',
    a: 'あなたのカード・ボードはあなた専用です。他のユーザーから見えることはありません（生成済み画像のキャッシュは単語単位で共有されますが、あなたがどの単語を登録したかは公開されません）。',
  },
]

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-semibold">
      <span style={{ color: 'var(--palace)' }}>{icon}</span>
      {children}
    </h2>
  )
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">使い方</h1>
        <p className="mt-2 text-muted-foreground">
          ImagePalace は、覚えたい言葉を「イメージ」に変えて記憶を助けるサービスです。はじめての方は、次の4ステップから始めてみてください。
        </p>
      </header>

      {/* 使い方ガイド */}
      <section className="mt-10 space-y-4">
        <SectionHeading icon={<Sparkles size={20} />}>使い方ガイド</SectionHeading>
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
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* できることの補足 */}
      <section className="mt-10 space-y-4">
        <SectionHeading icon={<Layers size={20} />}>ImagePalace でできること</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <Images size={18} style={{ color: 'var(--palace)' }} />
            <h3 className="mt-2 font-semibold">イメージカード</h3>
            <p className="mt-1 text-sm text-muted-foreground">単語や概念を、記憶に残るイメージ付きのカードとして管理できます。</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <Layers size={18} style={{ color: 'var(--palace)' }} />
            <h3 className="mt-2 font-semibold">フリーボード</h3>
            <p className="mt-1 text-sm text-muted-foreground">カードを配置し、線でつないで関係を「地図」のように可視化できます。</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <RefreshCw size={18} style={{ color: 'var(--palace)' }} />
            <h3 className="mt-2 font-semibold">再生成</h3>
            <p className="mt-1 text-sm text-muted-foreground">気に入らない画像や失敗したカードは作り直せます（失敗からの再生成は無料）。</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <Sparkles size={18} style={{ color: 'var(--palace)' }} />
            <h3 className="mt-2 font-semibold">かしこいキャッシュ</h3>
            <p className="mt-1 text-sm text-muted-foreground">同じ単語は一度だけ生成して再利用。待ち時間とコストを抑えます。</p>
          </div>
        </div>
      </section>

      {/* よくある質問 */}
      <section className="mt-10 space-y-4">
        <SectionHeading icon={<HelpCircle size={20} />}>よくある質問</SectionHeading>
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
      </section>

      {/* 用語集 */}
      <section className="mt-10 space-y-4">
        <SectionHeading icon={<BookMarked size={20} />}>用語集</SectionHeading>
        <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="px-4 py-3">
              <dt className="font-semibold">{g.term}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{g.desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* サイトマップ */}
      <section className="mt-10 space-y-4">
        <SectionHeading icon={<Map size={20} />}>サイトマップ</SectionHeading>
        <nav className="space-y-5 rounded-xl border border-border bg-card p-5">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground">横断</h3>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {GLOBAL_ACTIONS.map((a) => (
                <li key={a.href}>
                  <Link href={a.href!} className="transition-colors hover:text-[var(--palace)]">
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-muted-foreground">{section.title}</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {section.items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <Link href={item.href} className="font-medium transition-colors hover:text-[var(--palace)]">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="font-medium">{item.label}</span>
                    )}
                    {item.children && (
                      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-4 text-muted-foreground">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link href={child.href!} className="transition-colors hover:text-[var(--palace)]">
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/entrance">
          <Button>さっそく始める</Button>
        </Link>
        <Link href="/blog">
          <Button variant="outline">コラムを読む</Button>
        </Link>
      </div>
    </div>
  )
}
