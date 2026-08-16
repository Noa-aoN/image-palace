import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { HeroDescription, type HeroDescriptionVariant } from '@/components/features/landing/HeroDescription'

// LP検討用デモ: ヒーロー説明文の見せ方3案の比較ページ。
//
// 紙を敷く（現行）と、縁取りで読ませる案を、**実際のヒーロー画像の上で**並べる。
// 単色の上で比べても意味がない。効くかどうかは背景の明暗で決まるので、
// 明るいところ（石畳・空）と暗いところ（扉・柱の陰）の両方に当てて見る。

export const metadata: Metadata = {
  title: 'ヒーロー説明文の見せ方3案（検討用）',
  robots: { index: false, follow: false },
}

const VARIANTS: { key: HeroDescriptionVariant; title: string; body: string }[] = [
  {
    key: 'panel',
    title: '案A: 半透明の紙（現行）',
    body:
      'いちばん読みやすい。ただし紙の面積ぶん背景が隠れる。' +
      '宮殿・扉・石畳を見せたいのに、いちばん見せたい中央がこれで覆われている。',
  },
  {
    key: 'outline',
    title: '案B: 縁取りのみ（紙なし）',
    body:
      '字のぶんしか隠さない。背景はほぼそのまま見える。' +
      '弱点は明るい場所で、白い石畳や空の上では白い縁が背景に溶けて輪郭が消える。',
  },
  {
    key: 'soft',
    title: '案C: 縁取り＋ごく薄い紙（折衷）',
    body:
      '紙は 18% だけ。字の下がわずかに沈むので、明るい場所でも縁が残る。' +
      '案Aより覆う量はずっと少ないが、面が1枚あることは分かる。',
  },
]

// 背景の明暗で結果が変わるので、当てる場所を変えて2回ずつ見せる。
// object-position で、同じ画像の「明るいところ」と「暗いところ」を出し分ける
const SPOTS = [
  { label: '明るいところ（空・石畳）', position: 'center 18%' },
  { label: '暗いところ（扉・柱の陰）', position: 'center 62%' },
]

function Stage({ position, children }: { position: string; children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden rounded-xl" style={{ minHeight: 320 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-palace.webp?v=2"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: position }}
      />
      <div className="relative flex min-h-[320px] items-center justify-center p-6">{children}</div>
    </div>
  )
}

export default function HeroTextProposalsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-14 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-widest" style={{ color: 'var(--palace)' }}>
          LP 検討用
        </p>
        <h1 className="text-2xl font-bold tracking-tight">ヒーロー説明文の見せ方</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          背景をどれだけ隠すかと、どれだけ読めるかの釣り合いを見るためのページ。
          同じ文言を3通りで置き、それぞれ<strong>明るい背景と暗い背景の両方</strong>に当てている。
          明暗のどちらかだけで決めると、もう一方で読めなくなる。
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          縁の太さは <code className="rounded bg-muted px-1">--outline-w</code>（globals.css の{' '}
          <code className="rounded bg-muted px-1">.hero-outline</code>）で調整する。
          太くするほど明るい背景に強くなるが、画数の多い字の内側が白で埋まる。
        </p>
      </header>

      {VARIANTS.map((variant) => (
        <section key={variant.key} className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{variant.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{variant.body}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {SPOTS.map((spot) => (
              <div key={spot.label} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{spot.label}</p>
                <Stage position={spot.position}>
                  <HeroDescription variant={variant.key} />
                </Stage>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">見るときの勘どころ</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">画数の多い字を見る。</strong>
            「憶」「繰」「験」あたりで、内側の隙間が白く埋まっていないか。
            埋まっていれば縁が太すぎる。
          </li>
          <li>
            <strong className="text-foreground">太字と地の字を見比べる。</strong>
            縁は太字のほうが効きやすい。地の字だけ読みにくければ、縁ではなく字の濃さの問題。
          </li>
          <li>
            <strong className="text-foreground">狭い画面で見る。</strong>
            字が小さくなるほど縁は不利になる。実機の幅で確かめること。
          </li>
        </ul>
      </section>
    </main>
  )
}
