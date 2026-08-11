/**
 * Wikipedia を、押さずとも調べ始めてよいか。
 *
 * 足した瞬間に空の枠が出るだけだと、もう一度「調べる」を押させることになる。
 * Wikipedia は他の項目と違い、押せば中身まで入るのが値打ちなので、そこまで一息で進める。
 *
 * ただし勝手に走ってよい場面は狭い。3つとも満たすときだけ。
 *
 *   1. 作った直後である … 既にある項目に効かせると、カードを開くたびに引き直し、
 *      手で選んだ記事が黙って別のものに変わる
 *   2. まだ値が無い … 値があるなら引く理由がない
 *   3. まだ走っていない … 再描画のたびに走ると、候補を選んでいる最中に引き直す
 */
export function shouldAutoLookup({
  justCreated,
  hasValue,
  alreadyStarted,
}: {
  justCreated: boolean
  hasValue: boolean
  alreadyStarted: boolean
}): boolean {
  return justCreated && !hasValue && !alreadyStarted
}
