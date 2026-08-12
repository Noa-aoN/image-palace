import { apiClient } from './client'

/**
 * 二要素認証（TOTP）。
 *
 * **秘密鍵と復旧コードは、画面に出す以外のことをしない。**
 * localStorage にも sessionStorage にも置かない。console にも出さない。
 * 置いた先が漏れれば、二要素が二要素でなくなる。
 *
 * QR はブラウザの中で作る（`uqr`）。外部の QR 生成サービスへ送ると、
 * 秘密鍵をそのまま第三者に渡すことになる。
 */
export type TotpStatus = {
  enrolled: boolean
  /** 残りの復旧コード。少なくなったら作り直しを勧めるため */
  recovery_codes_left: number
  reauthenticated: boolean
}

export type TotpEnrollment = {
  /** 手入力用。QR を読めない端末のために必ず出す */
  secret: string
  /** 認証アプリへ渡す URI。これを QR にする */
  provisioning_uri: string
}

export async function getTotpStatus(): Promise<TotpStatus> {
  const res = await apiClient.get<TotpStatus>('/api/v1/totp')
  return res.data
}

export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const res = await apiClient.post<TotpEnrollment>('/api/v1/totp')
  return res.data
}

/** 確認が通ると復旧コードが返る。**返るのはこの1回だけ** */
export async function confirmTotp(code: string): Promise<{ recovery_codes: string[] }> {
  const res = await apiClient.post<{ recovery_codes: string[] }>('/api/v1/totp/confirm', { code })
  return res.data
}

/**
 * 外す。**コードはここで求めない。**
 * 確かめ方は共通の口（/reauth）に寄せてある。確かめが切れていれば 403 が返る
 */
export async function disableTotp(): Promise<void> {
  await apiClient.delete('/api/v1/totp')
}
