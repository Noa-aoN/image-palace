import type { Metadata } from 'next'
import { LegalLayout } from '@/components/features/legal/LegalLayout'

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記',
  description: 'ImagePalace の特定商取引法に基づく表記です。',
  robots: { index: true, follow: true },
}

// 特定商取引法に基づく表記。
//
// 個人で運営しているので、氏名・住所・電話番号は「請求があれば遅滞なく開示する」
// 運用にしている（消費者庁が個人事業主向けに認めている書き方）。
// **「請求があったら本当に遅滞なく開示する」ことが条件**なので、
// 問い合わせ先だけは必ず生きているものを載せること。
//
// ※ お問い合わせ先は未確定。決まり次第 CONTACT_EMAIL を差し替える。
const CONTACT_EMAIL = 'support@imagepalace.app'
const ON_REQUEST = '請求があった場合には、遅滞なく開示いたします。'

const ROWS: { label: string; value: React.ReactNode }[] = [
  { label: '販売事業者', value: ON_REQUEST },
  { label: '所在地', value: ON_REQUEST },
  { label: '電話番号', value: ON_REQUEST },
  {
    label: 'お問い合わせ',
    value: (
      <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
        {CONTACT_EMAIL}
      </a>
    ),
  },
  {
    label: '販売価格',
    value: '各有料プランの料金は、料金ページ（ログイン後の「プランを見る」）に表示します。表示価格は消費税込みです。',
  },
  {
    label: '商品代金以外の必要料金',
    value: 'インターネット接続料金・通信料金等は利用者の負担となります。',
  },
  {
    label: '支払方法',
    value: 'クレジットカード決済（決済代行：Stripe）。',
  },
  {
    label: '支払時期',
    value:
      'サブスクリプションは、初回はお申し込み時に決済され、以後は各課金期間の更新日に自動的に決済されます。',
  },
  {
    label: '役務の提供時期',
    value: '決済完了後、ただちに利用できます（生成クレジット等は決済確認後すみやかに付与されます）。',
  },
  {
    label: '解約・自動更新',
    value:
      'サブスクリプションは課金期間ごとに自動更新されます。次回更新日の前までに、ログイン後の管理画面（顧客ポータル）からいつでも解約できます。解約後は、契約期間の満了をもって有料機能の提供を終了します。',
  },
  {
    label: '返品・キャンセル（返金）',
    value:
      'サービスの性質上、決済後の返金は原則として行いません。すでに付与されたクレジット・利用済みの役務についても返金の対象外です。法令により返金が必要な場合はこの限りではありません。',
  },
  {
    label: '動作環境',
    value: '最新版の主要ブラウザ（Google Chrome / Safari / Microsoft Edge / Firefox 等）を推奨します。',
  },
]

export default function TokushohoPage() {
  return (
    <LegalLayout title="特定商取引法に基づく表記" updatedAt="最終更新日: 2026-08-12">
      <p>特定商取引法第11条に基づき、以下のとおり表示します。</p>

      <dl className="divide-y" style={{ borderColor: 'var(--palace)' }}>
        {ROWS.map(({ label, value }) => (
          <div key={label} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="font-semibold" style={{ color: '#111111' }}>
              {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </LegalLayout>
  )
}
