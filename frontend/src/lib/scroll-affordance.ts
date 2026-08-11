/**
 * 「まだ下に続きがあるか」の判定。
 *
 * 高さで切った領域は、切ったことが見た目に出ない。読み手は最後の行が
 * 文の終わりだと思って読むのをやめてしまう。続きがあるあいだだけ
 * 下端をぼかして、その手前に何かあると分かるようにする。
 *
 * 端まで読んだらぼかしを消す。消さないと、最後の一行がずっと薄いままになる。
 */
export function hasMoreBelow(
  { scrollTop, scrollHeight, clientHeight }: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  /** 端とみなす余白。小数のズレで最後の1pxが残ることがある */
  tolerance = 2
): boolean {
  return scrollHeight - clientHeight - scrollTop > tolerance
}
