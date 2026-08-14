import { describe, it, expect } from 'vitest'
import { buildManifest, START_URL, THEME_COLOR, BACKGROUND_COLOR } from '@/lib/pwa/manifest'
import { PRIVATE_PATHS } from '@/lib/site'

// 端末に入れて使うための素性書き。
// **入れたあとに壊れていても気づきにくい**（普段のブラウザでは症状が出ない）ので、
// 端末が拒む条件をここで押さえる。
describe('PWA の素性書き', () => {
  const manifest = buildManifest()

  it('入れられる最低条件を満たす（名前・入口・出方・絵）', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBe(START_URL)
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons?.length).toBeGreaterThan(0)
  })

  it('192 と 512 の絵を持つ（どちらが欠けても入れられない端末がある）', () => {
    const sizes = manifest.icons?.map((icon) => icon.sizes)

    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('角を丸く切る端末のために、内側に寄せた絵を別に持つ', () => {
    const maskable = manifest.icons?.filter((icon) => icon.purpose === 'maskable')

    expect(maskable?.length).toBe(1)
    expect(maskable?.[0].src).not.toBe(
      manifest.icons?.find((icon) => icon.purpose === 'any' && icon.sizes === '512x512')?.src
    )
  })

  it('絵はすべて自ホストに置く（外から取ると CSP に弾かれる）', () => {
    for (const icon of manifest.icons ?? []) {
      expect(icon.src.startsWith('/')).toBe(true)
    }
  })

  it('入口も近道も、アプリの持ち場から出ない', () => {
    const scope = manifest.scope ?? '/'
    const urls = [manifest.start_url, ...(manifest.shortcuts ?? []).map((s) => s.url)]

    for (const url of urls) {
      expect(url?.startsWith(scope)).toBe(true)
    }
  })

  it('入口はログインした人の持ち物側にする（ホーム画面から開くのは知っている人）', () => {
    expect(PRIVATE_PATHS).toContain(START_URL)
  })

  it('色は決め打ちの16進で持つ（CSS 変数は端末が読めない）', () => {
    expect(THEME_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(BACKGROUND_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(manifest.theme_color).toBe(THEME_COLOR)
    expect(manifest.background_color).toBe(BACKGROUND_COLOR)
  })
})
