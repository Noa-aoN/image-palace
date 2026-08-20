import { describe, it, expect } from 'vitest'
import {
  navSectionsFor,
  ADMIN_ITEM,
  STUDIO_ITEM,
  ADMIN_SECTION_KEY,
} from '@/components/features/layout/nav-items'

// 「公庁」の末尾に、その人に見せてよい入口を足す。
//
// **役割では決めない。** できることの名前で決める。
// 執務室（運営）と公式工房（制作）は別の軸なので、片方だけ持つ人が居る。
const NOBODY = { opsRoom: false, officialStudio: false }
const OPS_ONLY = { opsRoom: true, officialStudio: false }
const STUDIO_ONLY = { opsRoom: false, officialStudio: true }
const BOTH = { opsRoom: true, officialStudio: true }

const labelsOf = (entries: Parameters<typeof navSectionsFor>[0]) =>
  navSectionsFor(entries).flatMap((section) => section.items.map((item) => item.label))

describe('navSectionsFor', () => {
  it('何も持っていなければ、どちらも出さない', () => {
    expect(labelsOf(NOBODY)).not.toContain(ADMIN_ITEM.label)
    expect(labelsOf(NOBODY)).not.toContain(STUDIO_ITEM.label)
  })

  it('運営なら執務室が付く', () => {
    const ops = navSectionsFor(OPS_ONLY).find((s) => s.key === ADMIN_SECTION_KEY)
    expect(ops?.items.at(-1)?.label).toBe(ADMIN_ITEM.label)
  })

  // ここが要。**制作だけの人に、運営の入口を見せない**
  it('制作だけの人には、公式工房だけが付く', () => {
    const labels = labelsOf(STUDIO_ONLY)
    expect(labels).toContain(STUDIO_ITEM.label)
    expect(labels).not.toContain(ADMIN_ITEM.label)
  })

  it('両方持っていれば、両方付く', () => {
    const labels = labelsOf(BOTH)
    expect(labels).toContain(ADMIN_ITEM.label)
    expect(labels).toContain(STUDIO_ITEM.label)
  })

  it('セクションを増やさない（同じ表題が2つ並ばない）', () => {
    const sections = navSectionsFor(BOTH)
    expect(sections).toHaveLength(navSectionsFor(NOBODY).length)
    expect(new Set(sections.map((s) => s.title)).size).toBe(sections.length)
  })

  it('セクションの鍵は重複しない（React の鍵に使うため）', () => {
    for (const entries of [NOBODY, OPS_ONLY, STUDIO_ONLY, BOTH]) {
      const keys = navSectionsFor(entries).map((section) => section.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('同じセクションの中で項目の見出しが重複しない', () => {
    for (const section of navSectionsFor(BOTH)) {
      const labels = section.items.map((item) => item.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('子の見出しも兄弟の中で重複しない', () => {
    for (const section of navSectionsFor(BOTH)) {
      for (const item of section.items) {
        const labels = (item.children ?? []).map((child) => child.label)
        expect(new Set(labels).size).toBe(labels.length)
      }
    }
  })

  it('元の定義を書き換えない', () => {
    navSectionsFor(BOTH)
    expect(labelsOf(NOBODY)).not.toContain(ADMIN_ITEM.label)
    expect(labelsOf(NOBODY)).not.toContain(STUDIO_ITEM.label)
  })
})
