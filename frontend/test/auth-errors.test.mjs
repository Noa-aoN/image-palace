import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLoginErrorDetail,
  buildSignupErrorDetail,
  validateLoginField,
  validateSignupEmail,
  validateSignupPassword,
  validateSignupPasswordConfirmation,
} from '../src/lib/auth-errors.ts'

function axiosError(data) {
  return {
    isAxiosError: true,
    response: {
      data,
    },
  }
}

test('validateSignupEmail returns an error for invalid email format', () => {
  assert.equal(validateSignupEmail('aaa@aaa'), undefined)
  assert.equal(validateSignupEmail('aaaa'), 'メールアドレスの形式が正しくありません')
})

test('validateSignupPassword enforces minimum length 8', () => {
  assert.equal(validateSignupPassword('1234567'), 'パスワードは8文字以上で入力してください')
  assert.equal(validateSignupPassword('12345678'), undefined)
})

test('validateSignupPasswordConfirmation returns mismatch message', () => {
  assert.equal(validateSignupPasswordConfirmation('password123', 'password999'), 'パスワードが一致していません')
  assert.equal(validateSignupPasswordConfirmation('password123', 'password123'), undefined)
})

test('validateLoginField validates required fields and email format', () => {
  assert.equal(validateLoginField('email', ''), 'メールアドレスを入力してください')
  assert.equal(validateLoginField('password', ''), 'パスワードを入力してください')
  assert.equal(validateLoginField('email', 'aaa'), 'メールアドレスの形式が正しくありません')
  assert.equal(validateLoginField('email', 'aaa@aaa'), undefined)
})

test('buildLoginErrorDetail returns a short login message', () => {
  assert.equal(buildLoginErrorDetail(new Error('invalid')).message, 'メールアドレスまたはパスワードが違います。')
})

test('buildSignupErrorDetail maps backend validation errors to summary and field errors', () => {
  const detail = buildSignupErrorDetail(axiosError({
    errors: {
      full_messages: [
        'Email is invalid',
        "Password is too short (minimum is 8 characters)",
      ],
    },
  }))

  assert.equal(detail.summaryMessage, '入力内容をご確認ください。')
  assert.deepEqual(detail.formMessages, [])
  assert.deepEqual(detail.fieldErrors, {
    email: 'メールアドレスの形式が正しくありません',
    password: 'パスワードは8文字以上で入力してください',
  })
})

test('buildSignupErrorDetail keeps non-field communication errors in formMessages', () => {
  const detail = buildSignupErrorDetail({
    isAxiosError: true,
  })

  assert.equal(detail.summaryMessage, null)
  assert.deepEqual(detail.formMessages, ['通信に失敗しました。時間をおいてお試しください。'])
  assert.deepEqual(detail.fieldErrors, {})
})
