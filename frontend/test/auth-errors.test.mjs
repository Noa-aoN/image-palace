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

test('buildLoginErrorDetail maps unauthorized to a Japanese retry message', () => {
  const detail = buildLoginErrorDetail(axiosError({
    error: 'Unauthorized',
  }))

  assert.equal(detail.message, 'ログインが必要です。もう一度お試しください。')
})

test('buildLoginErrorDetail maps unconfirmed-account messages to Japanese', () => {
  const detail = buildLoginErrorDetail(axiosError({
    errors: ["A confirmation email was sent to your account at 'test@example.com'. You must follow the instructions in the email before your account can be activated"],
  }))

  assert.equal(detail.message, 'メール確認が完了していません。受信したメールをご確認ください。')
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

test('buildSignupErrorDetail maps "Email is not an email" to the standard Japanese email message', () => {
  const detail = buildSignupErrorDetail(axiosError({
    errors: {
      full_messages: ['Email is not an email'],
    },
  }))

  assert.equal(detail.summaryMessage, '入力内容をご確認ください。')
  assert.deepEqual(detail.formMessages, [])
  assert.deepEqual(detail.fieldErrors, {
    email: 'メールアドレスの形式が正しくありません',
  })
})

test('buildSignupErrorDetail maps missing confirm_success_url to a Japanese configuration message', () => {
  const detail = buildSignupErrorDetail(axiosError({
    errors: {
      full_messages: ["Missing 'confirm_success_url' parameter."],
    },
  }))

  assert.equal(detail.summaryMessage, null)
  assert.deepEqual(detail.formMessages, ['登録処理に必要な情報が不足しています。時間をおいて再度お試しください。'])
  assert.deepEqual(detail.fieldErrors, {})
})

test('buildSignupErrorDetail maps redirect_url_not_allowed to a Japanese configuration message', () => {
  const detail = buildSignupErrorDetail(axiosError({
    errors: {
      full_messages: ["Redirect to 'http://localhost:3000/login' not allowed."],
    },
  }))

  assert.equal(detail.summaryMessage, null)
  assert.deepEqual(detail.formMessages, ['認証設定に問題があります。時間をおいて再度お試しください。'])
  assert.deepEqual(detail.fieldErrors, {})
})

test('buildSignupErrorDetail maps malformed signup payload errors to a Japanese retry message', () => {
  const detail = buildSignupErrorDetail(axiosError({
    errors: {
      full_messages: ['Please submit proper sign up data in request body.'],
    },
  }))

  assert.equal(detail.summaryMessage, null)
  assert.deepEqual(detail.formMessages, ['入力内容を確認して、もう一度お試しください。'])
  assert.deepEqual(detail.fieldErrors, {})
})

test('buildSignupErrorDetail keeps non-field communication errors in formMessages', () => {
  const detail = buildSignupErrorDetail({
    isAxiosError: true,
  })

  assert.equal(detail.summaryMessage, null)
  assert.deepEqual(detail.formMessages, ['通信に失敗しました。時間をおいてお試しください。'])
  assert.deepEqual(detail.fieldErrors, {})
})
