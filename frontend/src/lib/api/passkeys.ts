import { apiClient } from './client'

/**
 * Passkey（WebAuthn）。
 *
 * 鍵そのものは端末の中から出てこない。ここでやり取りするのは、
 * 認証器への指示と、認証器が返した公開鍵だけ。
 * それでも**どこにも溜めない**（localStorage にも console にも出さない）。
 *
 * ArrayBuffer と JSON の詰め替えは `@simplewebauthn/browser` に任せる。
 * 自前で書くと、符号化を1つ間違えただけで「なぜか登録できない」になる。
 */
export type Passkey = {
  id: string
  nickname: string | null
  /** 名前が無いときの見出し（登録日から作る） */
  display_name: string
  created_at: string
  last_used_at: string | null
}

export async function listPasskeys(): Promise<Passkey[]> {
  const res = await apiClient.get<{ credentials: Passkey[] }>('/api/v1/passkeys')
  return res.data.credentials
}

/** 登録の始め。認証器へ渡す指示が返る（この時点ではまだ登録されない） */
export async function startPasskeyRegistration(): Promise<{ options: PublicKeyCredentialCreationOptionsJSON }> {
  const res = await apiClient.post<{ options: PublicKeyCredentialCreationOptionsJSON }>('/api/v1/passkeys')
  return res.data
}

/** 認証器が作った鍵を預ける。ここで初めて登録される */
export async function finishPasskeyRegistration(payload: {
  credential: unknown
  challenge: string
  nickname?: string
}): Promise<Passkey> {
  const res = await apiClient.post<{ credential: Passkey }>('/api/v1/passkeys/callback', payload)
  return res.data.credential
}

export async function renamePasskey(id: string, nickname: string): Promise<Passkey> {
  const res = await apiClient.patch<{ credential: Passkey }>(`/api/v1/passkeys/${id}`, { nickname })
  return res.data.credential
}

export async function removePasskey(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/passkeys/${id}`)
}

/** `@simplewebauthn/browser` が受け取る形。詰め替えはそちらに任せる */
type PublicKeyCredentialCreationOptionsJSON = Parameters<
  typeof import('@simplewebauthn/browser').startRegistration
>[0]['optionsJSON']
