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

export function validateLoginField(field: 'email' | 'password', value: string): string | undefined {
  if (field === 'email' && !value.trim()) return 'メールアドレスを入力してください'
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

export function buildLoginErrorDetail(error: unknown): LoginErrorDetail {
  if (axios.isAxiosError(error) && !error.response) {
    return {
      message: '通信に失敗しました。時間をおいてお試しください。',
    }
  }

  return {
    message: 'メールアドレスまたはパスワードが違います。',
  }
}
