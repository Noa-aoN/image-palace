import axios from 'axios'

export type AuthFieldErrors = Partial<Record<'email' | 'password' | 'passwordConfirmation', string>>

export type SignupErrorDetail = {
  summaryMessage: string | null
  formMessages: string[]
  fieldErrors: AuthFieldErrors
}

export type LoginErrorDetail = {
  message: string
}

export type PasswordResetFieldErrors = Partial<Record<'password' | 'passwordConfirmation', string>>

export type PasswordResetErrorDetail = {
  summaryMessage: string | null
  formMessages: string[]
  fieldErrors: PasswordResetFieldErrors
}

export function validateLoginField(field: 'email' | 'password', value: string): string | undefined {
  if (field === 'email' && !value.trim()) return 'メールアドレスを入力してください'
  if (field === 'email' && !/^[^@\s]+@[^@\s]+$/.test(value.trim())) {
    return 'メールアドレスの形式が正しくありません'
  }
  if (field === 'password' && !value.trim()) return 'パスワードを入力してください'
  return undefined
}

export function validateSignupEmail(value: string): string | undefined {
  if (!value.trim()) return 'メールアドレスを入力してください'
  if (!/^[^@\s]+@[^@\s]+$/.test(value)) return 'メールアドレスの形式が正しくありません'
  return undefined
}

export function validateSignupPassword(value: string): string | undefined {
  if (!value) return 'パスワードを入力してください'
  if (value.length < 8) return 'パスワードは8文字以上で入力してください'
  return undefined
}

export function validateSignupPasswordConfirmation(
  password: string,
  passwordConfirmation: string
): string | undefined {
  if (!passwordConfirmation) return '確認用パスワードを入力してください'
  if (password !== passwordConfirmation) return 'パスワードが一致していません'
  return undefined
}

function extractMessages(error: unknown): string[] {
  if (!axios.isAxiosError(error)) return []

  const data = error.response?.data as
    | { errors?: string[] | { full_messages?: string[] }; error?: string }
    | undefined

  const messages = data?.errors

  if (Array.isArray(messages)) return messages
  if (Array.isArray(messages?.full_messages)) return messages.full_messages
  if (typeof data?.error === 'string') return [data.error]

  return []
}

function mapSignupMessage(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('email') && normalized.includes('taken')) {
    return 'このメールアドレスはすでに使われています'
  }

  if (normalized.includes('email') && normalized.includes('invalid')) {
    return 'メールアドレスの形式が正しくありません'
  }

  if (normalized.includes('email') && normalized.includes('not an email')) {
    return 'メールアドレスの形式が正しくありません'
  }

  if (normalized.includes('password') && normalized.includes('too short')) {
    return 'パスワードは8文字以上で入力してください'
  }

  if (normalized.includes('password confirmation') && normalized.includes("doesn't match")) {
    return 'パスワードが一致していません'
  }

  if (normalized.includes('password') && normalized.includes("can't be blank")) {
    return 'パスワードを入力してください'
  }

  if (normalized.includes('email') && normalized.includes("can't be blank")) {
    return 'メールアドレスを入力してください'
  }

  if (normalized.includes('missing') && normalized.includes('confirm_success_url')) {
    return '登録処理に必要な情報が不足しています。時間をおいて再度お試しください。'
  }

  if (normalized.includes('redirect to') && normalized.includes('not allowed')) {
    return '認証設定に問題があります。時間をおいて再度お試しください。'
  }

  if (normalized.includes('proper sign up data')) {
    return '入力内容を確認して、もう一度お試しください。'
  }

  return message
}

function mapSignupFieldErrors(messages: string[]): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {}

  messages.forEach((message) => {
    const normalized = message.toLowerCase()

    if (normalized.includes('email')) {
      fieldErrors.email = mapSignupMessage(message)
      return
    }

    if (normalized.includes('password confirmation')) {
      fieldErrors.passwordConfirmation = mapSignupMessage(message)
      return
    }

    if (normalized.includes('password')) {
      fieldErrors.password = mapSignupMessage(message)
    }
  })

  return fieldErrors
}

export function buildSignupErrorDetail(error: unknown): SignupErrorDetail {
  if (axios.isAxiosError(error) && !error.response) {
    return {
      summaryMessage: null,
      formMessages: ['通信に失敗しました。時間をおいてお試しください。'],
      fieldErrors: {},
    }
  }

  const rawMessages = extractMessages(error)
  const formMessages = rawMessages.map(mapSignupMessage)
  const fieldErrors = mapSignupFieldErrors(rawMessages)

  if (formMessages.length > 0) {
    const hasFieldErrors = Object.keys(fieldErrors).length > 0

    return {
      summaryMessage: hasFieldErrors ? '入力内容をご確認ください。' : null,
      formMessages: hasFieldErrors ? [] : formMessages,
      fieldErrors,
    }
  }

  return {
    summaryMessage: null,
    formMessages: ['入力内容を確認して、もう一度お試しください。'],
    fieldErrors: {},
  }
}

export function validateForgotPasswordEmail(value: string): string | undefined {
  if (!value.trim()) return 'メールアドレスを入力してください'
  if (!/^[^@\s]+@[^@\s]+$/.test(value)) return 'メールアドレスの形式が正しくありません'
  return undefined
}

export function validateResetPassword(value: string): string | undefined {
  if (!value) return '新しいパスワードを入力してください'
  if (value.length < 8) return 'パスワードは8文字以上で入力してください'
  return undefined
}

export function validateResetPasswordConfirmation(
  password: string,
  passwordConfirmation: string
): string | undefined {
  if (!passwordConfirmation) return '確認用パスワードを入力してください'
  if (password !== passwordConfirmation) return 'パスワードが一致していません'
  return undefined
}

function mapResetPasswordMessage(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('password') && normalized.includes('too short')) {
    return 'パスワードは8文字以上で入力してください'
  }

  if (normalized.includes('password confirmation') && normalized.includes("doesn't match")) {
    return 'パスワードが一致していません'
  }

  if (normalized.includes('password') && normalized.includes("can't be blank")) {
    return '新しいパスワードを入力してください'
  }

  if (normalized.includes('reset password token') && normalized.includes('invalid')) {
    return 'リセットリンクが無効、または期限切れです。再度パスワードリセットをお試しください。'
  }

  return message
}

function mapResetPasswordFieldErrors(messages: string[]): PasswordResetFieldErrors {
  const fieldErrors: PasswordResetFieldErrors = {}

  messages.forEach((message) => {
    const normalized = message.toLowerCase()

    if (normalized.includes('password confirmation')) {
      fieldErrors.passwordConfirmation = mapResetPasswordMessage(message)
      return
    }

    if (normalized.includes('password')) {
      fieldErrors.password = mapResetPasswordMessage(message)
    }
  })

  return fieldErrors
}

export function buildForgotPasswordErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && !error.response) {
    return '通信に失敗しました。時間をおいてお試しください。'
  }

  return 'メール送信に失敗しました。時間をおいて再度お試しください。'
}

export function buildResetPasswordErrorDetail(error: unknown): PasswordResetErrorDetail {
  if (axios.isAxiosError(error) && !error.response) {
    return {
      summaryMessage: null,
      formMessages: ['通信に失敗しました。時間をおいてお試しください。'],
      fieldErrors: {},
    }
  }

  if (axios.isAxiosError(error) && error.response?.status === 401) {
    return {
      summaryMessage: null,
      formMessages: ['リセットリンクが無効、または期限切れです。再度パスワードリセットをお試しください。'],
      fieldErrors: {},
    }
  }

  const rawMessages = extractMessages(error)
  const formMessages = rawMessages.map(mapResetPasswordMessage)
  const fieldErrors = mapResetPasswordFieldErrors(rawMessages)

  if (formMessages.length > 0) {
    const hasFieldErrors = Object.keys(fieldErrors).length > 0

    return {
      summaryMessage: hasFieldErrors ? '入力内容をご確認ください。' : null,
      formMessages: hasFieldErrors ? [] : formMessages,
      fieldErrors,
    }
  }

  return {
    summaryMessage: null,
    formMessages: ['入力内容を確認して、もう一度お試しください。'],
    fieldErrors: {},
  }
}

export function buildLoginErrorDetail(error: unknown): LoginErrorDetail {
  if (axios.isAxiosError(error) && !error.response) {
    return {
      message: '通信に失敗しました。時間をおいてお試しください。',
    }
  }

  const rawMessages = extractMessages(error)
  const normalized = rawMessages.map((message) => message.toLowerCase())

  if (normalized.some((message) => message.includes('unauthorized'))) {
    return {
      message: 'ログインが必要です。もう一度お試しください。',
    }
  }

  if (normalized.some((message) => message.includes('not found'))) {
    return {
      message: '必要な情報が見つかりませんでした。時間をおいて再度お試しください。',
    }
  }

  if (normalized.some((message) => message.includes('redirect to') && message.includes('not allowed'))) {
    return {
      message: '認証設定に問題があります。時間をおいて再度お試しください。',
    }
  }

  if (normalized.some((message) => message.includes('confirmation email was sent'))) {
    return {
      message: 'メール確認が完了していません。受信したメールをご確認ください。',
    }
  }

  return {
    message: 'メールアドレスまたはパスワードが違います。',
  }
}
