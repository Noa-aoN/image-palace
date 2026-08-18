// 重い画像を、**見た目を変えずに**軽くする。
//
//   node tools/optimize-assets.mjs
//
// ## 何を変えて、何を変えないか
//
// **寸法は原則そのまま。** 実際に表示している大きさを測ってから決めた。
//
//   road.png    720x1080 で敷き詰める（元 1024x1536）
//               → 等倍未満。Retina では既に 1.4 倍へ引き伸ばしている。縮めたら粗くなる
//   road-pillar 手前の柱は最大 1340x2010 まで伸びる（元 480x720）
//               → 既に 2.8 倍。縮めたら粗くなる
//
// 変えるのは**入れ物だけ**。road は透過つきの写真のような絵なので、
// PNG だと桁がひとつ大きい。WebP にすれば同じ寸法・同じ見た目で 1/10 になる。
//
// ## 門だけは用途で分ける
//
// `auth-gate.webp` は2か所で使われていて、大きさが桁違いだった。
//
//   ログイン画面 … 画面いっぱい（実測 1440x900、Retina なら 2880px 必要）
//   LP の道の先 … 最大 115x80
//
// 原寸を縮めるとログイン画面が粗くなり、そのままだと LP が 200KB を無駄に運ぶ。
// **遠くの門だけ別に持つ。** 元絵は触らない。
import sharp from 'sharp'
import { statSync } from 'node:fs'

/** 地色。透過つきの絵を「実際の見え方」で比べるときに使う */
const IVORY = '#F4EFE6'

const kb = (p) => (statSync(p).size / 1024).toFixed(0)

/**
 * 寸法を変えず、入れ物だけ WebP にする。
 *
 * 透過を持つので `alphaQuality: 100`。ここを削ると、道の縁の
 * 薄れ方がざらついて、地色との境目に輪郭が出る。
 */
async function toWebp(src, dest, quality) {
  await sharp(src).webp({ quality, alphaQuality: 100, effort: 6 }).toFile(dest)
  console.log(`${src} → ${dest}  ${kb(src)}KB → ${kb(dest)}KB  (${(100 - statSync(dest).size / statSync(src).size * 100).toFixed(0)}% 減)`)
}

// 道。q88 は地色に重ねた状態で平均差 0.82／255（実測）。
// 720px 幅へ縮めて敷く絵なので、この差は画面に出ない
await toWebp('public/road.png', 'public/road.webp', 88)

// 柱。引き伸ばして使うので、道より少し高い品質を残す
await toWebp('public/road-pillar.png', 'public/road-pillar.webp', 90)

// 遠くの門。**115px でしか出ないので 480px あれば足りる**（DPR4 まで持つ）。
// ログイン画面が使う原寸（3072px）はそのまま残す
await sharp('public/auth-gate.webp')
  .resize(480)
  .webp({ quality: 86, alphaQuality: 100, effort: 6 })
  .toFile('public/auth-gate-far.webp')
console.log(
  `public/auth-gate.webp → public/auth-gate-far.webp  ${kb('public/auth-gate.webp')}KB → ` +
    `${kb('public/auth-gate-far.webp')}KB  (LP の遠景専用。ログイン画面は原寸のまま)`
)

// 見た目が変わっていないことを、地色に重ねた状態で測る
for (const [before, after] of [
  ['public/road.png', 'public/road.webp'],
  ['public/road-pillar.png', 'public/road-pillar.webp'],
]) {
  const [a, b] = await Promise.all(
    [before, after].map((f) => sharp(f).flatten({ background: IVORY }).raw().toBuffer())
  )
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  console.log(`  ${after} の見た目の差: 平均 ${(sum / a.length).toFixed(2)} / 255`)
}
