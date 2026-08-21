import { describe, it, expect } from 'vitest'
import { bodyFor, hintFor, PAGE_HELP } from '@/lib/page-help'

// 場所ごとの案内文。**書いてある場所を1つにする。**
//
// これまでサイドバーとページで別々に書かれていて、片方だけ直る形だった。
describe('場所ごとの案内文', () => {
  it('指を乗せたときの一言を引ける', () => {
    expect(hintFor('/items')).toBeTruthy()
    expect(hintFor('/study/quiz')).toBeTruthy()
  })

  it('見出しの下の説明を引ける', () => {
    expect(bodyFor('/settings')).toBeTruthy()
    expect(bodyFor('/study/quiz')).toBeTruthy()
  })

  it('知らない場所は空で返す（落ちない）', () => {
    expect(hintFor('/nowhere')).toBeUndefined()
    expect(bodyFor('/nowhere')).toBeUndefined()
  })

  // **短いほうと長いほうを分ける。**
  // 短いだけだとページが素っ気なくなり、長いだけだと指を乗せたときに読み切れない
  it('一言のほうが、説明より短い', () => {
    const both = Object.values(PAGE_HELP).filter((h) => h.hint && h.body)

    expect(both.length).toBeGreaterThan(10)
    for (const help of both) {
      expect(help.hint!.length).toBeLessThanOrEqual(help.body!.length)
    }
  })

  // サイドバーに出る場所は、全部に一言がある（名前だけを出さない）
  it('主な場所には、必ず一言がある', () => {
    const places = [
      '/items', '/views', '/spaces', '/boxes', '/materials',
      '/items/new', '/views/new', '/spaces/new', '/boxes/new',
      '/study/practice', '/study/quiz', '/study/game', '/study/record',
      '/achievements', '/settings', '/billing', '/account',
      '/news', '/guide', '/blog',
      '/admin', '/studio',
    ]

    for (const place of places) {
      expect(hintFor(place), `${place} に一言が無い`).toBeTruthy()
    }
  })

  it('句点で終わらない一言にする（並べたときに揃う）', () => {
    for (const [href, help] of Object.entries(PAGE_HELP)) {
      if (!help.hint) continue
      expect(help.hint.endsWith('。'), `${href} の一言が句点で終わっている`).toBe(false)
    }
  })
})
