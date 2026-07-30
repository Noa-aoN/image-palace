import { describe, expect, it } from 'vitest'
import {
  resolveRoomStyle,
  gridStroke,
  shadeSurface,
  ROOM_STYLE_PRESETS,
  ROOM_STYLE_KEYS,
  DEFAULT_ROOM_STYLE,
} from '@/lib/room-style'

const space = (room_style: string, style_overrides = {}) => ({ room_style, style_overrides })

// 相対輝度（WCAG 準拠の簡易版）。配色の視認性チェックに使う
function luminance(hex: string): number {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  const ch = [ (n >> 16) & 255, (n >> 8) & 255, n & 255 ].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

describe('resolveRoomStyle', () => {
  it('プリセットの値をそのまま返す', () => {
    expect(resolveRoomStyle(space('dark')).floor).toBe(ROOM_STYLE_PRESETS.dark.style.floor)
  })

  it('未知のプリセット名・未指定は既定にフォールバックする', () => {
    const fallback = ROOM_STYLE_PRESETS[DEFAULT_ROOM_STYLE].style.floor
    expect(resolveRoomStyle(space('neon')).floor).toBe(fallback)
    expect(resolveRoomStyle(null).floor).toBe(fallback)
  })

  it('上書きした項目だけがプリセットより優先される', () => {
    const s = resolveRoomStyle(space('ivory', { floor_color: '#123456' }))
    expect(s.floor).toBe('#123456')
    expect(s.wall).toBe(ROOM_STYLE_PRESETS.ivory.style.wall)
  })

  it('グリッドの濃さ・表示も上書きできる', () => {
    const s = resolveRoomStyle(space('ivory', { grid_opacity: 0.5, grid_visible: false }))
    expect(s.gridOpacity).toBe(0.5)
    expect(s.gridVisible).toBe(false)
  })

  // false は falsy なので ?? を使わないと拾えない。取り違えると「非表示にできない」不具合になる
  it('grid_visible の false を無視しない', () => {
    expect(resolveRoomStyle(space('ivory', { grid_visible: false })).gridVisible).toBe(false)
  })
})

describe('gridStroke', () => {
  it('非表示のときは完全透明にする', () => {
    const s = resolveRoomStyle(space('ivory', { grid_visible: false }))
    expect(gridStroke(s)).toMatch(/,\s*0\)$/)
  })

  it('表示のときは濃さを反映する', () => {
    const s = resolveRoomStyle(space('ivory', { grid_opacity: 0.3 }))
    expect(gridStroke(s)).toContain('0.3')
  })

  it('グリッド線の色を上書きできる（hex → rgba に変換する）', () => {
    const s = resolveRoomStyle(space('ivory', { grid_color: '#ff0000', grid_opacity: 0.5 }))
    expect(gridStroke(s)).toBe('rgba(255, 0, 0, 0.5)')
  })
})

describe('プリセット定義', () => {
  it('すべてのプリセットが必要な色を持つ', () => {
    for (const key of ROOM_STYLE_KEYS) {
      const s = ROOM_STYLE_PRESETS[key].style
      for (const c of [s.floor, s.wall, s.ceiling, s.edge, s.background]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      }
      expect(s.gridOpacity).toBeGreaterThan(0)
      expect(s.gridOpacity).toBeLessThanOrEqual(1)
    }
  })

  // 暗い床に黒い線を引くと沈んで見えなくなる
  it('暗い床のプリセットは明るいグリッド線を使う', () => {
    expect(ROOM_STYLE_PRESETS.dark.style.gridLine).toBe('#ffffff')
  })

  // 「ダークが視認できない」問題の再発防止。
  // 3D は壁が半透明なので、部屋の形は「床と背景の差」「稜線と背景の差」で読ませている。
  it('どのプリセットも床が背景から浮いて見える', () => {
    for (const key of ROOM_STYLE_KEYS) {
      const s = ROOM_STYLE_PRESETS[key].style
      expect(Math.abs(luminance(s.floor) - luminance(s.background))).toBeGreaterThan(0.05)
    }
  })

  it('どのプリセットも稜線が背景から見分けられる', () => {
    for (const key of ROOM_STYLE_KEYS) {
      const s = ROOM_STYLE_PRESETS[key].style
      expect(Math.abs(luminance(s.edge) - luminance(s.background))).toBeGreaterThan(0.08)
    }
  })

  it('どのプリセットもグリッド線が床から見分けられる', () => {
    for (const key of ROOM_STYLE_KEYS) {
      const s = ROOM_STYLE_PRESETS[key].style
      expect(Math.abs(luminance(s.gridLine) - luminance(s.floor))).toBeGreaterThan(0.15)
    }
  })

  it('壁と床は明度が異なる（面の境目が分かる）', () => {
    for (const key of ROOM_STYLE_KEYS) {
      const s = ROOM_STYLE_PRESETS[key].style
      expect(Math.abs(luminance(s.wall) - luminance(s.floor))).toBeGreaterThan(0.02)
    }
  })
})

describe('shadeSurface', () => {
  it('明度だけを動かす', () => {
    expect(shadeSurface('#808080', 16)).toBe('#909090')
    expect(shadeSurface('#808080', -16)).toBe('#707070')
  })

  it('0〜255 をはみ出さない', () => {
    expect(shadeSurface('#ffffff', 40)).toBe('#ffffff')
    expect(shadeSurface('#000000', -40)).toBe('#000000')
  })

  it('3 桁の hex も扱える', () => {
    expect(shadeSurface('#fff', 0)).toBe('#ffffff')
  })
})
