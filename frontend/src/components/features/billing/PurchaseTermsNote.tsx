import Link from 'next/link'
import { CREDIT_VALIDITY_LABEL } from '@/lib/billing'

/**
 * 買う前に見せておく決まりごと。
 *
 * 特定商取引法は、**申し込みの最終確認画面**で、量・総額・支払時期・提供時期・
 * 解約の方法を出すことを求める。この先は Stripe の画面へ出てしまい、
 * そこに「解約の方法」は出ない。**だからここで出す。**
 *
 * 解約の案内は、これまで契約中の人にだけ見えていた（お支払い管理の節）。
 * これから買う人が、買う前に解約の方法を読めないのは順番が逆なので、
 * 契約の有無にかかわらず出す。
 */
export function PurchaseTermsNote({ kind }: { kind: 'subscription' | 'topup' }) {
  const items =
    kind === 'subscription'
      ? [
          '表示価格は消費税込みです。お支払いいただく金額は、次の画面（Stripe）でご確認いただけます。',
          'お申し込み時に決済され、以後は毎月の更新日に自動的に更新・決済されます。',
          'クレジットは決済の確認後にお渡しし、受け取りから' + CREDIT_VALIDITY_LABEL + '間ご利用いただけます。',
          '解約は「お支払いを管理」からいつでも行え、現在の請求期間の終了をもって有効になります。それまでは引き続きご利用いただけます。期間の途中で解約された場合でも、日割りでの返金は行いません。',
        ]
      : [
          '表示価格は消費税込みです。お支払いいただく金額は、次の画面（Stripe）でご確認いただけます。',
          '購入時に一度だけ決済されます。自動更新はありません。',
          'クレジットは決済の確認後にお渡しし、購入から' + CREDIT_VALIDITY_LABEL + '間ご利用いただけます。',
          'デジタルサービスの性質上、購入後のお客様のご都合による返金は原則としてお受けしていません。',
        ]

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
      <p className="mb-2 font-medium text-foreground">お申し込みの前にご確認ください</p>
      <ul className="list-disc space-y-1 pl-4">
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
      <p className="mt-3">
        詳しくは
        <Link href="/tokushoho" className="underline underline-offset-2 hover:text-foreground">
          特定商取引法に基づく表記
        </Link>
        および
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          利用規約
        </Link>
        をご覧ください。
      </p>
    </div>
  )
}
