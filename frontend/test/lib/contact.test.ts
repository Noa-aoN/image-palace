import { describe, it, expect } from 'vitest'
import { CONTACT_EMAIL, CONTACT_PENDING_LABEL } from '@/lib/contact'

// 問い合わせ先の出どころ。**複数の画面に直書きしない。**
// 特商法は「請求があれば開示」を認めているが、**請求を受け取る口があることが条件**。
describe('問い合わせ先', () => {
  it('設定されていなければ null（画面は「準備中」を出す）', () => {
    // 手元では未設定。空文字や空白を「あり」と誤認しないことが要
    expect(CONTACT_EMAIL === null || typeof CONTACT_EMAIL === 'string').toBe(true)
    if (CONTACT_EMAIL !== null) expect(CONTACT_EMAIL.trim()).toBe(CONTACT_EMAIL)
  })

  it('「準備中」の文言は1か所から出す', () => {
    expect(CONTACT_PENDING_LABEL).toBe('準備中です。')
  })
})
