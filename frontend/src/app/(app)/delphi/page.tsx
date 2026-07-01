import { redirect } from 'next/navigation'

// 旧 /delphi は /acropolis に改名済み。ブックマーク等の救済として恒久リダイレクトする。
export default function DelphiRedirectPage() {
  redirect('/acropolis')
}
