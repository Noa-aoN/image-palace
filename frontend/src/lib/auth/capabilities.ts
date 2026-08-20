import type { AdminSession, Capabilities, Capability } from '@/types/admin'

// できることの名前で、画面の出し分けを決める。
//
// **役割の文字列を画面に持ち込まない。**
// 持ち込むと出し分けの条件が役割で書かれ始め、役割が増えたときに全部を見直すことになる。
//
// ここは見た目の話であって、守りではない。
// 実際の判定はサーバー側で毎リクエスト行われるので、ここを書き換えても何も開かない。

/** その能力を持っているか。分からないときは持っていない扱い */
export function can(
  session: Pick<AdminSession, 'capabilities'> | null | undefined,
  capability: Capability
): boolean {
  return session?.capabilities?.[capability] === true
}

/** どれか1つでも持っているか */
export function canAny(
  session: Pick<AdminSession, 'capabilities'> | null | undefined,
  capabilities: Capability[]
): boolean {
  return capabilities.some((c) => can(session, c))
}

/**
 * サイドバーに出す入口。
 *
 * **`公庁` の中に足すものを、ここで1か所にまとめる。**
 * 出す・出さないの条件が画面のあちこちに散らないように。
 */
export type OpsEntries = {
  /** 執務室 */
  opsRoom: boolean
  /** 工房室 */
  officialStudio: boolean
}

export function opsEntriesFor(
  session: Pick<AdminSession, 'capabilities'> | null | undefined
): OpsEntries {
  return {
    opsRoom: can(session, 'access_ops_room'),
    officialStudio: can(session, 'access_official_studio'),
  }
}

/**
 * ヘッダーに出す肩書き。
 *
 * **両方持っていることがある。** そのときは強いほう（運営）を出す。
 * 2つ並べると、狭い画面で場所を取り合う。
 */
export type Badge = { label: string; hint: string } | null

export function badgeFor(
  session: Pick<AdminSession, 'capabilities' | 'owner'> | null | undefined
): Badge {
  if (can(session, 'access_ops_room')) {
    return session?.owner
      ? { label: '運営', hint: '運営の管理者として見ています' }
      : { label: '運営', hint: '運営として見ています' }
  }
  if (can(session, 'access_official_studio')) {
    return { label: '公式工房', hint: '公式コンテンツの制作権限があります' }
  }
  return null
}

/**
 * 本人確認（パスキー・認証アプリ）が要る人か。
 *
 * **執務室と工房は、どちらも入るときに確かめる。**
 * だから、どちらかに入れる人には設定が要る。
 *
 * ここを役割で見ると、工房だけを使う口座（役割は `user`）が
 * **設定できないまま閉め出される**。実際にそうなった。
 */
export function needsStrongAuth(
  session: Pick<AdminSession, 'capabilities'> | null | undefined
): boolean {
  return canAny(session, ['access_ops_room', 'access_official_studio'])
}

export type { Capabilities, Capability }
