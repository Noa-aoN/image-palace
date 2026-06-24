import { redirect } from 'next/navigation'

// 旧デッキ詳細はビュー(view_type='deck')へ統合済み。一覧へ集約する。
export default function DeckDetailRedirect() {
  redirect('/views?type=deck')
}
