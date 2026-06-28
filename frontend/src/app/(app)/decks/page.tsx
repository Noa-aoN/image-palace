import { redirect } from 'next/navigation'

// デッキはキャンバスの一種（view_type='deck'）に統合済み。/views?type=deck へ集約。
export default function DecksPage() {
  redirect('/views?type=deck')
}
