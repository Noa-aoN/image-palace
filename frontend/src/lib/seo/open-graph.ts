import { SITE_NAME } from '@/lib/site'

// ページが自分の `openGraph` を書くと、**親（ルート）の指定は引き継がれない**。
// 丸ごと差し替わるので、`siteName` と `locale` が黙って消える。
// 消えたことは画面に出ないし、テストも落ちない。SNS に貼った時だけ、
// カードの上のサービス名が抜けて分かる。
//
// だから自分で openGraph を書くページは、これを必ず混ぜる。
export const OG_SITE = {
  siteName: SITE_NAME,
  locale: 'ja_JP',
} as const
