import { redirect } from 'next/navigation'

// 旧 /arena は /stadion に改名済み。ブックマーク等の救済として恒久リダイレクトする。
export default function ArenaRedirectPage() {
  redirect('/stadion')
}
