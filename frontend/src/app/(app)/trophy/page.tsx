import { redirect } from 'next/navigation'

// 「トロフィー」は宝物アイテムの一種であって場所の名前ではないため、
// ページは「アチーブメント」に統一した。古いリンクや履歴から来た人を送る
export default function TrophyPage() {
  redirect('/achievements')
}
