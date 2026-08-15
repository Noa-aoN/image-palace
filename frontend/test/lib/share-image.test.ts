import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { shareImage, SECTION_SHARE_IMAGE, type ShareSection } from '@/lib/seo/share-image'
import { ARTICLES } from '@/lib/blog/articles'

// SNS に貼られたときの絵。**空だと、リンクが文字だけの帯になる。**
describe('共有したときの絵', () => {
  it('自前の絵が無ければ、その区画の絵を返す', () => {
    expect(shareImage('blog')).toBe('/og/blog.jpg')
    expect(shareImage('guide')).toBe('/og/guide.jpg')
  })

  it('記事が自分の絵を持っていれば、そちらを使う', () => {
    expect(shareImage('blog', '/lp/a.webp')).toBe('/lp/a.webp')
  })

  it('空文字・空白・null は自前の絵として扱わない', () => {
    expect(shareImage('blog', '')).toBe('/og/blog.jpg')
    expect(shareImage('blog', '   ')).toBe('/og/blog.jpg')
    expect(shareImage('blog', null)).toBe('/og/blog.jpg')
  })

  it('どの区画でも必ず絵を返す（空では返さない）', () => {
    for (const section of Object.keys(SECTION_SHARE_IMAGE) as ShareSection[]) {
      expect(shareImage(section)).toMatch(/^\/.+\.(jpg|png|webp)$/)
    }
  })

  it('指している絵が実際に置いてある', () => {
    for (const path of Object.values(SECTION_SHARE_IMAGE)) {
      const file = resolve(__dirname, '../../public', path.replace(/^\//, ''))
      expect(existsSync(file), `${path} が無い`).toBe(true)
    }
  })

  it('記事が自分の絵を指しているなら、それも置いてある', () => {
    for (const article of ARTICLES) {
      if (!article.image) continue
      const file = resolve(__dirname, '../../public', article.image.replace(/^\//, ''))
      expect(existsSync(file), `${article.slug} の ${article.image} が無い`).toBe(true)
    }
  })
})
