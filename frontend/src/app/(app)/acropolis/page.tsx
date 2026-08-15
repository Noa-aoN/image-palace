import { redirect } from 'next/navigation'

// 神託を受け取る場所なので、名前をデルフォイに戻した。
// 一時期デルフォイと呼んでいたぶん、ブックマークや履歴の救済として残す。
export default function AcropolisRedirectPage() {
  redirect('/delphi')
}
