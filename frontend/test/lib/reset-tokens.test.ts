import { describe, it, expect } from 'vitest'
import { parseResetTokens } from '@/lib/auth/reset-tokens'

// パスワード再設定の着地で、合鍵を `#` の側から読めているか。
//
// 以前はクエリ（`?`）から読んでいた。クエリはサーバーのログ・ブラウザの履歴・
// Referer に残るため、バックエンドごとフラグメントへ移した。
// **`?` に戻すと、合鍵がログに残る形に逆戻りする。**
describe('parseResetTokens', () => {
  const full = 'access-token=abc&client=cli&uid=me%40example.com&reset_password=true'

  it('3つ揃っていれば読み取る', () => {
    expect(parseResetTokens(`#${full}`)).toEqual({
      accessToken: 'abc',
      client: 'cli',
      uid: 'me@example.com',
    })
  })

  it('先頭の # が無くても読める', () => {
    expect(parseResetTokens(full)).not.toBeNull()
  })

  // 半端な状態で画面を出すと、送信した瞬間に失敗するだけで理由が分からない
  it.each(['access-token', 'client', 'uid'])('%s が欠けたら受け取らない', (missing) => {
    const hash = full
      .split('&')
      .filter((pair) => !pair.startsWith(`${missing}=`))
      .join('&')

    expect(parseResetTokens(`#${hash}`)).toBeNull()
  })

  it('空なら null', () => {
    expect(parseResetTokens('')).toBeNull()
    expect(parseResetTokens('#')).toBeNull()
  })

  // 値が空文字のときも「持っている」扱いにしない
  it('値が空文字なら受け取らない', () => {
    expect(parseResetTokens('#access-token=&client=cli&uid=me')).toBeNull()
  })
})
