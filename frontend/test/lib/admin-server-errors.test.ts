import { describe, it, expect } from 'vitest'
import { serverErrorMessage, serverErrorMessages } from '@/lib/admin/server-errors'

const rejected = (data: unknown) => ({ response: { data } })

// 運営が保存を断られたとき、理由が画面に出るか。
// 「保存できませんでした」だけだと、何を直せばよいか分からない
describe('サーバーが断った理由', () => {
  it('errors 配列を取り出す', () => {
    const e = rejected({ errors: ['Rewards streak_days はクレジットを使わずに満たせるので、クレジットは配れません'] })

    expect(serverErrorMessage(e, '保存できませんでした')).toContain('クレジットは配れません')
  })

  it('error 単体でも取り出す', () => {
    expect(serverErrorMessage(rejected({ error: 'その鍵は既に使われています' }), '既定')).toBe(
      'その鍵は既に使われています'
    )
  })

  // 1つだけ見せると、直したのにまた断られる
  it('理由が複数あれば繋げて出す', () => {
    const e = rejected({ errors: ['上限を超えています', '無い獲得物が入っています'] })

    expect(serverErrorMessage(e, '既定')).toBe('上限を超えています / 無い獲得物が入っています')
  })

  it('理由が無ければ渡した言い方を返す', () => {
    expect(serverErrorMessage(rejected({}), '保存できませんでした')).toBe('保存できませんでした')
    expect(serverErrorMessage(new Error('通信できない'), '保存できませんでした')).toBe('保存できませんでした')
    expect(serverErrorMessage(undefined, '保存できませんでした')).toBe('保存できませんでした')
  })

  it('空文字や空配列は理由として扱わない', () => {
    expect(serverErrorMessages(rejected({ errors: [] }))).toEqual([])
    expect(serverErrorMessages(rejected({ error: '' }))).toEqual([])
    expect(serverErrorMessage(rejected({ errors: [''] }), '既定')).toBe('既定')
  })

  // errors が優先。両方来たときに片方を落とさない
  it('errors と error の両方が来たら errors を使う', () => {
    expect(serverErrorMessage(rejected({ errors: ['詳しい理由'], error: 'ざっくり' }), '既定')).toBe('詳しい理由')
  })
})
