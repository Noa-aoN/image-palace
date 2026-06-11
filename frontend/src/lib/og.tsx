import { ImageResponse } from 'next/og'

// OG 画像の標準サイズ（Twitter summary_large_image とも共通）
export const ogSize = { width: 1200, height: 630 }
export const ogContentType = 'image/png'
export const ogAlt = 'ImagePalace — 単語をイメージに変えて、記憶を設計する。'

const LABEL = 'IMAGE PALACE'
const HEADLINE = '単語を、イメージに。'
const SUBLINE = '記憶を設計する学習サービス'

const IVORY = '#F4EFE6'
const PALACE = '#C6A75E'
const INK = '#111111'

// ImageResponse の既定フォントは CJK を含まないため、必要な文字だけ
// Noto Sans JP をサブセット取得して豆腐化を防ぐ
async function loadJpFont(weight: number, text: string): Promise<ArrayBuffer | null> {
  const family = `Noto+Sans+JP:wght@${weight}`
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`
  try {
    const cssRes = await fetch(url, {
      headers: {
        // woff2 ではなく ttf を得るため一般的な UA を指定する
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    })
    if (!cssRes.ok) return null
    const css = await cssRes.text()
    const match = css.match(/src:\s*url\((.+?)\)\s*format\(['"]?(?:opentype|truetype)['"]?\)/)
    if (!match) return null
    const fontRes = await fetch(match[1])
    if (!fontRes.ok) return null
    return await fontRes.arrayBuffer()
  } catch {
    return null
  }
}

export async function renderOgImage(): Promise<ImageResponse> {
  const subsetText = LABEL + HEADLINE + SUBLINE
  const [bold, regular] = await Promise.all([
    loadJpFont(700, subsetText),
    loadJpFont(400, subsetText),
  ])

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[] = []
  if (regular) fonts.push({ name: 'NotoSansJP', data: regular, weight: 400, style: 'normal' })
  if (bold) fonts.push({ name: 'NotoSansJP', data: bold, weight: 700, style: 'normal' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: IVORY,
          padding: '72px 80px',
          fontFamily: 'NotoSansJP',
          position: 'relative',
        }}
      >
        {/* 右端のブランドアクセント帯 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 16,
            height: '100%',
            backgroundColor: PALACE,
          }}
        />

        {/* ラベル */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 8,
            color: PALACE,
          }}
        >
          {LABEL}
        </div>

        {/* 見出し */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 88, fontWeight: 700, color: INK, lineHeight: 1.15 }}>
            {HEADLINE}
          </div>
          <div style={{ fontSize: 40, fontWeight: 400, color: '#4A4A4A' }}>{SUBLINE}</div>
        </div>

        {/* フッター */}
        <div style={{ display: 'flex', fontSize: 26, color: '#6B6B6B' }}>
          image-palace
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  )
}
