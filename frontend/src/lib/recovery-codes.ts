/**
 * 復旧コードの控え。
 *
 * **見せられるのは設定を終えた1回だけ。** サーバーはハッシュで持っているので、
 * あとから出し直せない。だから、その場で確実に手元へ残せるようにする。
 *
 * 画面から読み取って書き写す人もいれば、貼り付けたい人も、
 * ファイルで置きたい人もいる。どれも同じ中身になるように、文字列はここで作る。
 */

/** 貼り付け用・ファイル用の中身。1行に1つ */
export function formatRecoveryCodes(codes: string[], now: Date): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return [
    'ImagePalace 二要素認証の復旧コード',
    `発行日: ${stamp}`,
    '',
    '認証アプリを使えなくなったとき、このコードで入れます。',
    '1つのコードは一度しか使えません。',
    '人に見せず、印刷するか安全な場所に控えてください。',
    '',
    ...codes,
    '',
  ].join('\n')
}

/** 保存するファイルの名前。日付を入れて、後から見て何のファイルか分かるように */
export function recoveryCodesFilename(now: Date): string {
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  return `imagepalace-recovery-codes-${stamp}.txt`
}

/**
 * 残りが少ないか。少なくなったまま気づかないと、いざというとき足りない。
 *
 * 半分を切ったら伝える。1本になってから言われても、
 * 作り直す手間は同じで、余裕だけが無い。
 */
export function recoveryCodesRunningLow(left: number, total = 10): boolean {
  return left > 0 && left <= Math.floor(total / 2)
}
