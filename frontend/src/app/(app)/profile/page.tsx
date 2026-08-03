import { redirect } from 'next/navigation'

// プロフィールは「アカウント管理」へ統合済み。後方互換のため /account へリダイレクトする。
export default function ProfilePage() {
  redirect('/account')
}
