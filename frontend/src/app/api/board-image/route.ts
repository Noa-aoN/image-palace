import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ボード画像書き出し用の「同一オリジン画像プロキシ」。
// クロスオリジン（dev: Rails active_storage / 本番: R2 presigned・CDN）の画像を
// サーバー側で取得し同一オリジンで返すことで、html-to-image のクロスオリジン fetch
// 失敗（CORS 未設定 → "Failed to fetch"）を回避する。
// SSRF 対策として、取得先ホストを既知のメディアホストに限定する。

function allowedHost(host: string): boolean {
  const h = host.toLowerCase()
  const allow = new Set<string>(['localhost:3001', '127.0.0.1:3001'])
  for (const key of ['NEXT_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_CDN_BASE_URL']) {
    const v = process.env[key]
    if (!v) continue
    try {
      allow.add(new URL(v).host.toLowerCase())
    } catch {
      /* 無効な URL は無視 */
    }
  }
  if (allow.has(h)) return true
  // Cloudflare R2（presigned 直配信 / r2.dev）
  return h.endsWith('.r2.cloudflarestorage.com') || h.endsWith('.r2.dev')
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src')
  if (!src) return new NextResponse('missing src', { status: 400 })

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return new NextResponse('invalid src', { status: 400 })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return new NextResponse('bad protocol', { status: 400 })
  }
  if (!allowedHost(url.host)) return new NextResponse('host not allowed', { status: 403 })

  try {
    const upstream = await fetch(url.toString(), { headers: { accept: 'image/*' } })
    if (!upstream.ok) return new NextResponse('upstream error', { status: 502 })
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
    if (!contentType.startsWith('image/')) return new NextResponse('not an image', { status: 415 })
    const buf = await upstream.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: { 'content-type': contentType, 'cache-control': 'private, max-age=300' },
    })
  } catch {
    return new NextResponse('fetch failed', { status: 502 })
  }
}
