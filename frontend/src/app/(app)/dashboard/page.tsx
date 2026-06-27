import { redirect } from 'next/navigation'

// 旧 /dashboard は /entrance に改名済み。ブックマーク等の救済として恒久リダイレクトする。
export default function DashboardRedirectPage() {
  redirect('/entrance')
}
