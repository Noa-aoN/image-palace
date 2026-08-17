// ブランド素材（アイコン・OGP）を、用途ごとの形へ焼き直す。
//
// 元絵は git に置かない（デザイン素材は Figma / docs 側が正本）。
// 走らせるときは元絵の場所を渡す:
//
//   node tools/brand-assets.mjs <アイコン元絵.png> <OGP元絵.png>
//
// **同じ絵をそのまま全部に配れない。** 用途ごとに要る形が違う:
//
//   favicon / icon      … 四隅は透過のまま。タブの地色に馴染む
//   apple-icon          … 透過は黒になる（iOS）。必ず地色で塗り潰す
//   maskable            … 端末が好きな形に切る。切られてよい余白を外周に持たせる
//
// 元絵は四隅が透過で、下側にだけ影が伸びている。影ごと入れると
// 「下に寄った絵」になるので、本体（不透明部分）だけを正方形で切り出す。

import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const [iconSrc, ogSrc] = process.argv.slice(2)
if (!iconSrc || !ogSrc) {
  console.error('使い方: node tools/brand-assets.mjs <アイコン元絵.png> <OGP元絵.png>')
  process.exit(1)
}

/** 元絵 1000x1000 のうち、影を除いた本体（実測 x39-969 / y37-967）*/
const BODY = { left: 39, top: 37, width: 931, height: 931 }

/** 地色。manifest の background_color と同じ */
const IVORY = '#F4EFE6'

/**
 * maskable の本体比率。
 * 端末が円で切っても角が欠けないのは、角丸(半径25%)の正方形なら
 * 対角の出っ張りが 0.604 * 辺。安全円の半径 0.4 に収めるには辺 <= 0.66。
 * 0.68 はその境目で、丸め残りは角のごく先端だけになる。
 */
const MASKABLE_SCALE = 0.68

const body = await sharp(iconSrc).extract(BODY).png().toBuffer()

// 元絵はグラデーションが多く、素の PNG だと 512px でも 500KB を超える。
// アイコンは全ページで読まれるので、256色に落として桁を下げる
// （見えるのは最大 512px の縮小絵。並べて比べても差は出ない）
const PNG_OPTS = { palette: true, quality: 90, effort: 10 }

/** 透過のまま。タブ・ブラウザのアイコン用 */
const transparent = (size) => sharp(body).resize(size, size).png(PNG_OPTS)

// --- ブラウザのタブ ---------------------------------------------------------
// .ico の中身は PNG で持てる（Vista 以降。現行ブラウザは全部読める）。
// **PNG は必ず RGBA にする。** RGB だと next build だけが落ちる（dev では出ない）
const icoSizes = [16, 32, 48]
const icoPngs = await Promise.all(
  icoSizes.map((s) => sharp(body).resize(s, s).ensureAlpha().png().toBuffer())
)
writeFileSync('src/app/favicon.ico', buildIco(icoSizes, icoPngs))

// --- Next.js のアイコン規約 -------------------------------------------------
await transparent(512).toFile('src/app/icon.png')

// iOS のホーム画面。
//
// 透過を黒として塗るので、地色を敷いてから渡す。加えて **94% に縮める**。
// iOS の角丸（22.4%）は元絵の角丸（25%）より浅いので、原寸のまま渡すと
// 四隅で金の縁が切れて輪が閉じない（実測。94% で閉じる）
const appleInner = Math.round(180 * 0.94)
await sharp({
  create: { width: 180, height: 180, channels: 4, background: IVORY },
})
  .composite([{ input: await sharp(body).resize(appleInner, appleInner).png().toBuffer() }])
  .flatten({ background: IVORY })
  .png(PNG_OPTS)
  .toFile('src/app/apple-icon.png')

// --- manifest のアイコン ----------------------------------------------------
await transparent(192).toFile('public/icons/icon-192.png')
await transparent(512).toFile('public/icons/icon-512.png')

const maskInner = Math.round(512 * MASKABLE_SCALE)
await sharp({
  create: { width: 512, height: 512, channels: 4, background: IVORY },
})
  .composite([{ input: await sharp(body).resize(maskInner, maskInner).png().toBuffer() }])
  .flatten({ background: IVORY })
  .png(PNG_OPTS)
  .toFile('public/icons/icon-maskable-512.png')

// --- OGP / Twitter ----------------------------------------------------------
// 元絵は 1731x909（縦横比 1.904）。1200x630（1.905）とほぼ同じなので歪まない
await sharp(ogSrc)
  .resize(1200, 630, { fit: 'cover' })
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile('src/app/opengraph-image.jpg')
await sharp(ogSrc)
  .resize(1200, 630, { fit: 'cover' })
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile('src/app/twitter-image.jpg')

console.log('できました')

/** PNG を並べて .ico の器に入れる（外部パッケージを増やさないため自前で組む） */
function buildIco(sizes, pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // 予約
  header.writeUInt16LE(1, 2) // 1 = アイコン
  header.writeUInt16LE(sizes.length, 4)

  let offset = 6 + 16 * sizes.length
  const entries = sizes.map((size, i) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size === 256 ? 0 : size, 0) // 幅
    e.writeUInt8(size === 256 ? 0 : size, 1) // 高さ
    e.writeUInt8(0, 2) // パレット色数（PNG なので 0）
    e.writeUInt8(0, 3) // 予約
    e.writeUInt16LE(1, 4) // プレーン数
    e.writeUInt16LE(32, 6) // ビット深度
    e.writeUInt32LE(pngs[i].length, 8)
    e.writeUInt32LE(offset, 12)
    offset += pngs[i].length
    return e
  })

  return Buffer.concat([header, ...entries, ...pngs])
}
