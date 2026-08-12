import { apiClient } from './client'

/**
 * 危険な操作の前の、もう一度の本人確認。
 *
 * **どの方法で確かめても、行き着く先は同じ。** 呼ぶ側は
 * 「確かめ終わったか」だけを見ればよく、手段を知る必要がない。
 *
 * 通ったことは**いま使っているこの端末**に紐づく。別の端末で確かめても、
 * こちらには効かない（机のパソコンで確かめた結果が、置き忘れた携帯に
 * 効いてはいけない）。
 */
export type StrongAuthMethod = 'passkey' | 'totp' | 'recovery_code'

export type ReauthStatus = {
  authenticated: boolean
  /** 使える確かめ方。画面はこの順に出す（使いやすいものが先） */
  methods: StrongAuthMethod[]
  window_minutes: number
}

export async function getReauthStatus(): Promise<ReauthStatus> {
  const res = await apiClient.get<ReauthStatus>('/api/v1/reauth')
  return res.data
}

/** パスキーの一段目。認証器へ渡す指示が返る */
export async function startReauthPasskey(): Promise<{ options: PublicKeyCredentialRequestOptionsJSON }> {
  const res = await apiClient.post<{ options: PublicKeyCredentialRequestOptionsJSON }>(
    '/api/v1/reauth/passkey/options'
  )
  return res.data
}

/** パスキーの二段目。署名を確かめる */
export async function verifyReauthPasskey(payload: {
  credential: unknown
  challenge: string
}): Promise<void> {
  await apiClient.post('/api/v1/reauth/passkey', payload)
}

/**
 * 認証アプリのコード、または復旧コード。
 * 利用者にとっては「コードを入れる」1つの操作なので、口も1つにする
 */
export async function verifyReauthCode(code: string): Promise<void> {
  await apiClient.post('/api/v1/reauth/code', { code })
}

type PublicKeyCredentialRequestOptionsJSON = Parameters<
  typeof import('@simplewebauthn/browser').startAuthentication
>[0]['optionsJSON']
