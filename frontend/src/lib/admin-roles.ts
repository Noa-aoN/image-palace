import type { AdminRole, AdminSession } from '@/types/admin'

/**
 * 段階の順位。**上位は下位を含む。**
 *
 * サーバー側（`User::ROLE_RANK`）と同じ並び。片方だけ足すと、
 * 画面には出るのに押すと断られる、という食い違いが出る。
 */
const RANK: Record<AdminRole, number> = {
  user: 0,
  support: 1,
  operator: 2,
  admin: 3,
}

export function roleRank(session: AdminSession | null | undefined): number {
  return session ? (RANK[session.role] ?? 0) : 0
}

export function atLeast(session: AdminSession | null | undefined, role: AdminRole): boolean {
  return roleRank(session) >= RANK[role]
}

/** 通常運用（配信・付与・設定変更）ができるか */
export function canOperate(session: AdminSession | null | undefined): boolean {
  return atLeast(session, 'operator')
}

/** 権限・お金・セキュリティを触れるか */
export function canAdminister(session: AdminSession | null | undefined): boolean {
  return atLeast(session, 'admin')
}

/**
 * ここでの出し分けは**見た目の話であって、守りではない**。
 * 守りは必ずサーバー側（require_role!）にある。
 *
 * それでも出し分けるのは、押せないものを押させないため。
 * 権限の足りない操作を出しておくと、押して 403 を踏むまで分からない。
 */
export const ROLE_LABELS: Record<AdminRole, string> = {
  user: '一般',
  support: 'サポート（閲覧のみ）',
  operator: '運営',
  admin: '運営の管理者',
}
