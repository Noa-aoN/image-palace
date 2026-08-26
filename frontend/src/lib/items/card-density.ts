/**
 * 札の密度。**大きさの段ではなく、「狭くなったとき何を残すか」の段。**
 *
 * 札は常に格子の幅いっぱいに広がる（固定の大きさを持たない）。
 * 変わるのは幅そのものではなく、**その幅で何が読めるか**のほう。
 *
 * 実測（1400px の窓）:
 *   3列  … 1枚 約440px … 見出しも項目も読める
 *   5列  … 1枚 約260px … 見出しは読める。項目は1行に収まらなくなる
 *   8列  … 1枚 約160px … 見出しが数文字で切れる
 *   10列 … 1枚 約120px … 絵しか見えない
 *
 * それでも項目を出し続けていたので、狭い格子では**読めない字が積まれる**だけだった。
 * 縦に伸びるぶん、絵も小さくなる。
 */

export type CardDensity = 'full' | 'compact' | 'bare'

/** 項目（意味・読み方など）が読める限界の列数。これを超えたら積まない */
const FIELDS_UNTIL = 6
/** 見出しが数文字で切れ始める列数。これを超えたら絵だけにする */
const TITLE_UNTIL = 8

export function densityFor(columns: number): CardDensity {
  if (columns <= FIELDS_UNTIL) return 'full'
  if (columns <= TITLE_UNTIL) return 'compact'
  return 'bare'
}

/** その密度で何を出すか。**画面はここに聞くだけにする**（判断を散らさない） */
export function cardShows(density: CardDensity): { title: boolean; fields: boolean; mark: boolean } {
  return {
    // 見出しはカードの身元。絵だけになるまでは落とさない
    title: density !== 'bare',
    fields: density === 'full',
    // 印は一文字なので、見出しが出せる幅なら一緒に出せる
    mark: density !== 'bare',
  }
}
