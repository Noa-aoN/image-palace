/**
 * 体験の宮殿でだす道案内。
 *
 * **入ってきた人は、何を見ればよいのか分からない。**
 * 宮殿には部屋がいくつもあり、体験では大半が灰色（使えない）になっている。
 * 「本物がどういうものか」を見てもらう場なのに、見る先を示さないと、
 * 押せる場所を探すところから始まってしまう。
 *
 * 見てほしい3つだけを、順に挙げる。**増やさない。**
 * 4つ以上あると、案内そのものが読み物になる。
 */

/** 体験で最初に開く場所。**エントランスではなくカード一覧**（中身があるのはこちら） */
export const DEMO_HOME = '/items'

export type DemoGuideStep = {
  key: string
  href: string
  label: string
  /** なぜそこを見るのか。押す前に分かるようにする */
  hint: string
}

export const DEMO_GUIDE_STEPS: DemoGuideStep[] = [
  {
    key: 'items',
    href: '/items',
    label: 'カード一覧をみてみよう',
    hint: '言葉がイメージになったものが並びます',
  },
  {
    key: 'boxes',
    href: '/boxes',
    label: 'ボックスをみてみよう',
    hint: 'カードをまとめて持ち歩く入れ物です',
  },
  {
    key: 'views',
    href: '/views',
    label: 'キャンバスをみてみよう',
    hint: 'カードを好きな場所に置いて、関係を描けます',
  },
]

/**
 * いまいる場所が、どの案内に当たるか。
 *
 * **下の階層も同じ場所として数える。** カードを1枚開いた人は
 * 「カード一覧を見た」に決まっているので、そこで済みにならないと、
 * 見終わったのに案内が残る。
 *
 * どれにも当たらなければ null（数えない）。
 */
export function demoStepForPath(pathname: string): string | null {
  const hit = DEMO_GUIDE_STEPS.find(
    (step) => pathname === step.href || pathname.startsWith(`${step.href}/`)
  )
  return hit?.key ?? null
}

/** 見た場所を控える。**同じものを二重に持たない** */
export function markSeen(seen: string[], key: string | null): string[] {
  if (!key || seen.includes(key)) return seen

  return [ ...seen, key ]
}

/** ぜんぶ見たか。見終わったら案内は畳む（役目を終えたものを残さない） */
export function allSeen(seen: string[]): boolean {
  return DEMO_GUIDE_STEPS.every((step) => seen.includes(step.key))
}
