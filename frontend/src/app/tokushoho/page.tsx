import type { Metadata } from 'next'
import { CONTACT_EMAIL, CONTACT_PENDING_LABEL } from '@/lib/contact'
import { LegalLayout } from '@/components/features/legal/LegalLayout'

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記',
  description: 'ImagePalace の特定商取引法に基づく表記です。',
  robots: { index: true, follow: true },
}

/**
 * 問い合わせ先。
 *
 * **正式なアドレスが決まるまで、本番では出さない。** 受け取れないアドレスを
 * 載せると、下の「請求があれば遅滞なく開示します」が成り立たなくなる
 * （請求を受け取る口が無いため）。
 *
 * 決まったら NEXT_PUBLIC_CONTACT_EMAIL に入れる。それまでは
 * 「準備中」と正直に出す。
 */
// 出どころは lib/contact.ts に1つだけ置く（フッターも同じものを見る）

/**
 * 氏名・住所・電話番号は、請求があったときに開示する。
 *
 * 特定商取引法は、個人で通信販売を行う場合に、この方式を認めている。
 * ただし**「請求されたら遅滞なく開示する」ことが条件**で、書けば済むものではない。
 * 開示する中身をあらかじめ決めて手元に置き、請求を受け取る口を用意しておくこと。
 */
const ON_REQUEST = '請求があった場合には、遅滞なく開示いたします。'

const ROWS: { label: string; value: React.ReactNode }[] = [
  { label: '販売事業者', value: ON_REQUEST },
  { label: '所在地', value: ON_REQUEST },
  { label: '電話番号', value: ON_REQUEST },
  {
    // 価格をここに書かない。料金を変えたとき、このページだけ古くなる。
    // 実際に支払う額は、購入前の確認画面（Stripe）で必ず出る
    label: '販売価格',
    value:
      '各プラン・商品の購入画面に表示します。表示価格は消費税込みです。お支払いいただく金額は、購入前の確認画面でご確認いただけます。',
  },
  {
    label: '商品代金以外の必要料金',
    value: 'インターネット接続料金・通信料金等は、利用者の負担となります。',
  },
  {
    label: '支払方法',
    value: 'クレジットカード決済（決済システム: Stripe）。',
  },
  {
    // サブスクと買い切りで時期が違う。まとめて書くと、どちらの話か分からなくなる
    label: '支払時期',
    value:
      '月額プランは、お申し込み時に決済され、以後は毎月の更新日に自動的に決済されます。クレジットの買い切りは、購入時に決済されます。',
  },
  {
    // 決済の完了は Stripe からの通知で確かめている。通知が届いてから付与するので、
    // 「即時」と言い切らない
    label: 'サービスの提供時期',
    value: '決済の確認後、すみやかにご利用いただけます（クレジットは決済確認後に付与されます）。',
  },
  {
    label: '解約・自動更新',
    value:
      '月額プランは、毎月自動的に更新されます。お支払い管理ページからいつでも解約でき、解約は現在の請求期間の終了をもって有効になります。それまでは引き続きご利用いただけます。期間の途中で解約された場合でも、日割りでの返金は行いません。',
  },
  {
    label: '返品・キャンセル（返金）',
    value:
      'デジタルサービスの性質上、提供開始後のお客様のご都合による返金は原則としてお受けしていません。ただし、法令上必要な場合、および当方の責めに帰すべき事由によりサービスを提供できない場合は、この限りではありません。',
  },
  {
    // ソフトウェアの取引では動作環境も表示事項に挙がる。実態の範囲で最小限を書く
    label: '動作環境',
    value:
      '最新版の主要ブラウザ（Google Chrome / Safari / Microsoft Edge / Firefox 等）でご利用いただけます。JavaScript が有効であること、およびインターネット接続が必要です。',
  },
  {
    label: 'お問い合わせ',
    value: CONTACT_EMAIL ? (
      <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
        {CONTACT_EMAIL}
      </a>
    ) : (
      CONTACT_PENDING_LABEL
    ),
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
