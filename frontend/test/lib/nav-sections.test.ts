import { describe, it, expect } from 'vitest'
import { navSectionsFor, ADMIN_ITEM, ADMIN_SECTION_KEY } from '@/components/features/layout/nav-items'

describe('navSectionsFor', () => {
  it('運営でなければ管理は出さない', () => {
    const labels = navSectionsFor(false).flatMap((section) => section.items.map((item) => item.label))
    expect(labels).not.toContain(ADMIN_ITEM.label)
  })

  it('運営なら「運営」セクションの末尾に管理が付く', () => {
    const ops = navSectionsFor(true).find((section) => section.key === ADMIN_SECTION_KEY)
    expect(ops?.items.at(-1)?.label).toBe(ADMIN_ITEM.label)
  })

  it('セクションを増やさない（同じ表題が2つ並ばない）', () => {
    const sections = navSectionsFor(true)
    expect(sections).toHaveLength(navSectionsFor(false).length)
    expect(new Set(sections.map((s) => s.title)).size).toBe(sections.length)
  })

  it('セクションの鍵は重複しない（React の鍵に使うため）', () => {
    for (const isAdmin of [false, true]) {
      const keys = navSectionsFor(isAdmin).map((section) => section.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('同じセクションの中で項目の見出しが重複しない', () => {
    for (const section of navSectionsFor(true)) {
      const labels = section.items.map((item) => item.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('子の見出しも兄弟の中で重複しない', () => {
    for (const section of navSectionsFor(true)) {
      for (const item of section.items) {
        const labels = (item.children ?? []).map((child) => child.label)
        expect(new Set(labels).size).toBe(labels.length)
      }
    }
  })

  it('元の定義を書き換えない', () => {
    navSectionsFor(true)
    const labels = navSectionsFor(false).flatMap((section) => section.items.map((item) => item.label))
    expect(labels).not.toContain(ADMIN_ITEM.label)
  })
})
