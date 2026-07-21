// 画像のダウンロード共通処理。
// R2/CDN の画像は blob 化してから <a download> で保存する。
// CORS 等で fetch できない場合は新規タブで開いてそこから保存してもらう。

/** ファイル名に使えない文字を落とす（拡張子は付けない）。 */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned.slice(0, 80) || 'image'
}

/** blob の MIME から拡張子を推定する。 */
function extFromBlob(blob: Blob): string {
  if (blob.type.includes('png')) return 'png'
  if (blob.type.includes('jpeg') || blob.type.includes('jpg')) return 'jpg'
  return 'webp'
}

/**
 * 画像 URL をダウンロードする。
 * @param url  画像 URL（サムネではなくオリジナルを渡すこと）
 * @param baseName 拡張子なしのファイル名（カードのタイトル等）
 */
export async function downloadImage(url: string, baseName: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `${safeFileName(baseName)}.${extFromBlob(blob)}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
