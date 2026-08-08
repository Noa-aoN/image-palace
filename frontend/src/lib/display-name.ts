/**
 * 表示名の既定値。
 *
 * 表示名は「外部アカウントの名前を初期値に、以後は本人が変えられる」1つの値だけを持つ。
 * 未設定のときに何を出すかを1か所に集約して、画面ごとに違う名前が出るのを防ぐ。
 */
export function defaultDisplayName(email?: string | null): string {
  const local = email?.split('@')[0]?.trim()
  return local || '主人'
}

export function displayNameOf(user?: { name?: string | null; email?: string } | null): string {
  return user?.name?.trim() || defaultDisplayName(user?.email)
}
