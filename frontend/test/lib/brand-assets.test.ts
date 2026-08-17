import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { buildManifest } from '@/lib/pwa/manifest'
import { SITE_NAME } from '@/lib/site'

// ブランドの顔（名前とアイコン）は、壊れても手元では気づけない。
//
//   favicon.ico の中身が RGB だと、**next build だけ**が落ちる（dev では出ない）
//   apple-icon が透過だと、iOS のホーム画面で**背景が黒く**なる
//   manifest の絵の名前がずれると、端末に入れる時だけ失敗する
//
// どれも出るのが本番なので、ここで先に落とす。

const path = (p: string) => resolve(process.cwd(), p)

/** PNG のヘッダから縦横と色の持ち方を読む（画像ライブラリを持ち込まない） */
function readPng(file: string) {
  const buf = readFileSync(file)
  const signature = buf.subarray(0, 8).toString('hex')
  expect(signature, `${file} が PNG ではない`).toBe('89504e470d0a1a0a')

  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const colorType = buf.readUInt8(25)
  // colorType 4=グレー+α, 6=RGBA。3=パレットは tRNS があれば透過を持てる
  const hasAlpha = colorType === 4 || colorType === 6 || (colorType === 3 && buf.includes('tRNS'))
  return { width, height, hasAlpha }
}

/** .ico を開いて、中に入っている PNG を取り出す */
function readIco(file: string) {
  const buf = readFileSync(file)
  expect(buf.readUInt16LE(0), '予約領域が 0 でない').toBe(0)
  expect(buf.readUInt16LE(2), 'アイコン種別が 1 でない').toBe(1)

  const count = buf.readUInt16LE(4)
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + 16 * i
    const declared = buf.readUInt8(entry) || 256
    const length = buf.readUInt32LE(entry + 8)
    const offset = buf.readUInt32LE(entry + 12)
    const png = buf.subarray(offset, offset + length)
    expect(png.subarray(0, 8).toString('hex'), 'ico の中身が PNG ではない').toBe('89504e470d0a1a0a')
    return { declared, width: png.readUInt32BE(16), colorType: png.readUInt8(25) }
  })
}

describe('ブランドの名前', () => {
  const manifest = buildManifest()

  it('端末に入れた時の名前が、サイト名と揃っている', () => {
    expect(SITE_NAME).toBe('IMAGE PALACE')
    expect(manifest.short_name).toBe(SITE_NAME)
    expect(manifest.name?.startsWith(SITE_NAME)).toBe(true)
  })

  it('ホーム画面のラベルが切られない長さに収まっている', () => {
    // 端末は 12 文字前後で打ち切る。超えると「IMAGE PALA…」のように出る
    expect(manifest.short_name!.length).toBeLessThanOrEqual(12)
  })
})

describe('SNS カードの名乗り', () => {
  /** src/app 以下の page.tsx を全部集める */
  function pages(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) pages(full, found)
      else if (entry.name === 'page.tsx') found.push(full)
    }
    return found
  }

  it('自分で openGraph を書くページは、必ず OG_SITE を混ぜている', () => {
    // ページ側の openGraph は親を**引き継がず丸ごと差し替える**ので、
    // 書いた瞬間に og:site_name が消える。消えても画面には出ない
    const offenders = pages(path('src/app')).filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.includes('openGraph: {') && !source.includes('...OG_SITE')
    })

    expect(offenders, `OG_SITE を足してください:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('ブランドのアイコン', () => {
  it('タブのアイコンは 16/32/48 を持ち、どれも透過を持つ', () => {
    const entries = readIco(path('src/app/favicon.ico'))
    expect(entries.map((e) => e.declared).sort((a, b) => a - b)).toEqual([16, 32, 48])
    for (const e of entries) {
      expect(e.width, `${e.declared}px の中身が宣言と違う`).toBe(e.declared)
      // 6 = RGBA。ここが 2（RGB）だと next build が落ちる
      expect(e.colorType, `${e.declared}px が RGBA でない`).toBe(6)
    }
  })

  it('iOS のホーム画面用は透過を持たない（透過は黒く塗られる）', () => {
    const icon = readPng(path('src/app/apple-icon.png'))
    expect(icon.width).toBe(180)
    expect(icon.height).toBe(180)
    expect(icon.hasAlpha).toBe(false)
  })

  it('ブラウザ用のアイコンは四隅の透過を保っている', () => {
    const icon = readPng(path('src/app/icon.png'))
    expect(icon.width).toBe(512)
    expect(icon.hasAlpha).toBe(true)
  })

  it('manifest が指す絵が、宣言どおりの大きさで実在する', () => {
    for (const icon of buildManifest().icons ?? []) {
      const file = path(`public${icon.src}`)
      expect(existsSync(file), `${icon.src} が無い`).toBe(true)

      const [w, h] = icon.sizes!.split('x').map(Number)
      const png = readPng(file)
      expect(png.width, `${icon.src} の幅`).toBe(w)
      expect(png.height, `${icon.src} の高さ`).toBe(h)
    }
  })

  it('SNS に貼られる絵が 1200x630 で実在する', () => {
    for (const name of ['opengraph-image.jpg', 'twitter-image.jpg']) {
      const file = path(`src/app/${name}`)
      expect(existsSync(file), `${name} が無い`).toBe(true)

      // JPEG の SOF から縦横を読む
      const buf = readFileSync(file)
      let i = 2
      let size: { width: number; height: number } | null = null
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) break
        const marker = buf[i + 1]
        const length = buf.readUInt16BE(i + 2)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
          break
        }
        i += 2 + length
      }
      expect(size, `${name} の大きさが読めない`).toEqual({ width: 1200, height: 630 })
    }
  })
})
