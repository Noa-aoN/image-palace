// ボード画像書き出しのユーティリティ。
// クロスオリジンのカード画像/背景画像を、同一オリジンの画像プロキシ（/api/board-image）
// 経由で取得して dataURL 化する。html-to-image が直接クロスオリジン fetch して
// CORS で失敗するのを避け、書き出し前に画像を dataURL に差し替えるために使う。
export async function proxiedDataUrl(src: string): Promise<string> {
  const res = await fetch(`/api/board-image?src=${encodeURIComponent(src)}`)
  if (!res.ok) throw new Error(`image proxy failed: ${res.status}`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 次の描画フレームまで待つ（fitView 後の DOM 反映待ちなどに使う）。 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
