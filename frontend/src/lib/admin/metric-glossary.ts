/**
 * 経営の指標をひとところで定義する。
 *
 * 略称・読み方・正式名称・意味・式・注意点を1件にまとめる。
 * 画面ごとに書くと、同じ略称に違う説明が付いて食い違う。
 *
 * **読み方は、揺れの大きいものは断定しない。** 迷う可能性のあるものは
 * `here` の側に「◯◯とも読む」と書き、カードには広く使われている方だけを出す。
 */
export type MetricDefinition = {
  /** カードに出す短い日本語の名前 */
  name: string
  /** 略称・英語の呼び名 */
  abbr: string
  /** カタカナの読み。読み方が自明なもの（Cards など）には付けない */
  reading?: string
  /** 正式名称 */
  fullName: string
  meaning: string
  formula: string
  why: string
  here: string
}

export const METRIC_GLOSSARY = {
  dau: {
    name: '1日あたりの利用者',
    abbr: 'DAU',
    reading: 'ダウ',
    fullName: 'Daily Active Users',
    meaning: '直近24時間のうちに来た人の数。',
    formula: 'users.last_seen_at が直近24時間に入る人を数える。',
    why: '毎日使われているかは、続けて使えているかの一番素直な現れ。',
    here: 'ImagePalace では「来た」だけを数える。カードを作ったかは Engagement で別に見る。',
  },
  wau: {
    name: '1週間あたりの利用者',
    abbr: 'WAU',
    reading: 'ワウ',
    fullName: 'Weekly Active Users',
    meaning: '直近7日のうちに来た人の数。',
    formula: 'users.last_seen_at が直近7日に入る人を数える。',
    why: '毎日ではなくても週に一度は戻ってくるか、という粒度で見られる。',
    here: '学習は毎日とは限らないので、DAU より実態に近いことが多い。',
  },
  mau: {
    name: '1か月あたりの利用者',
    abbr: 'MAU',
    reading: 'マウ',
    fullName: 'Monthly Active Users',
    meaning: '直近30日のうちに来た人の数。',
    formula: 'users.last_seen_at が直近30日に入る人を数える。',
    why: 'サービスの大きさを表す基本の数。多くの指標の母数にもなる。',
    here: '無料枠の周期（登録日から1か月ごと）と読み比べられるよう30日にしている。',
  },
  stickiness: {
    name: '粘着度',
    abbr: 'DAU/MAU',
    reading: 'スティッキネス',
    fullName: 'Stickiness',
    meaning: '月に来る人のうち、どれくらいが毎日来ているか。',
    formula: 'DAU ÷ MAU × 100',
    why: '習慣になっているかを見る。数が小さくても割合は意味を持つ。',
    here: '暗記は毎日やるほど効く。ここが上がるほど、道具として定着している。人数が少ないうちは 100% にも 0% にも振れるので、母数と一緒に読む。',
  },
  cardsCreated: {
    name: '作られたカード',
    abbr: 'Cards',
    fullName: 'Cards Created',
    meaning: '期間内に作られたカードの数。',
    formula: 'items の作成日時が期間内のものを数える。',
    why: 'ImagePalace で最初に起きる価値ある行動。',
    here: 'ここが動かないと、画像生成もクレジット消費も起きない。',
  },
  imagesGenerated: {
    name: '生成された画像',
    abbr: 'Images',
    fullName: 'Images Generated',
    meaning: '期間内の画像生成の回数（キャッシュで済んだぶんも含む）。',
    formula: 'image_usages の作成日時が期間内のものを数える。',
    why: '原価が発生する行動そのもの。売上と並べて見る。',
    here: 'キャッシュが効いたぶんは API を呼んでいないので、原価には数えていない。',
  },
  reviews: {
    name: '復習',
    abbr: 'Reviews',
    fullName: 'Reviews',
    meaning: '期間内に復習された回数。',
    formula: 'item_reviews の復習日時が期間内のものを数える。',
    why: '作って終わりではなく、学習に使われているかが分かる。',
    here: '記憶の定着がサービスの目的なので、作成数より重い意味を持つ。',
  },
  actingUsers: {
    name: '手を動かした人',
    abbr: 'Acting Users',
    fullName: 'Acting Users',
    meaning: 'カード作成・画像生成・復習・クレジット消費のどれかをした人の数。',
    formula: '4つの記録の user_id を重複を除いて数える。',
    why: '「来た」と「使った」は別のこと。使った人だけを見る。',
    here: 'Active（来た人）との差が、見に来ただけの人の数になる。',
  },
  totalUsers: {
    name: '登録者数',
    abbr: 'Total Users',
    fullName: 'Total Users',
    meaning: 'いま登録されている人の総数。',
    formula: 'users の全件。',
    why: '多くの割合の母数になる。',
    here: '退会した人は行ごと消えるため、ここには残らない。',
  },
  newUsers: {
    name: '新規登録',
    abbr: 'New Users',
    fullName: 'New Users',
    meaning: '期間内に登録した人の数。',
    formula: 'users の登録日時が期間内のものを数える。',
    why: '入口がどれだけ広がっているかを見る。',
    here: '広告を出していないので、いまは口コミと検索の結果がそのまま出る。',
  },
  payingUsers: {
    name: '支払っている人',
    abbr: 'Paying Users',
    fullName: 'Paying Users',
    meaning: 'いま有料契約が有効な人の数。',
    formula: 'status が active かつ本番（livemode）の契約を持つ人を重複を除いて数える。',
    why: '売上の source。ここが増えないかぎり MRR は伸びない。',
    here: 'お試し中（trialing）はまだ入金が無いので数に入れない。テスト契約も混ぜない。',
  },
  freeToPaidCvr: {
    name: '有料への転換率',
    abbr: 'Free→Paid CVR',
    reading: 'シーブイアール',
    fullName: 'Free to Paid Conversion Rate',
    meaning: '登録した人のうち、有料に至った割合。',
    formula: '支払っている人 ÷ 登録者数 × 100（期間で切らない累積）',
    why: '無料で使ってもらう設計が、商売として成立するかを決める。',
    here: '母数が小さいうちは1人の増減で大きく動く。傾向として見る。',
  },
  revenue: {
    name: '売上',
    abbr: 'Revenue',
    fullName: 'Revenue',
    meaning: '期間内に入った額（サブスクと買い切りの合計）。',
    formula: 'credit_transactions の金額のうち、本番（livemode）のものを合計する。',
    why: '説明の要らない、いちばん確かな数字。',
    here: '収支ページと同じ計算を使っている。テストの決済は別に出す。',
  },
  mrr: {
    name: '毎月入る額',
    abbr: 'MRR',
    reading: 'エムアールアール',
    fullName: 'Monthly Recurring Revenue',
    meaning: '契約が続くかぎり毎月入ってくる額。',
    formula: '有効な有料契約のプラン価格を合計する。',
    why: '一度きりの売上と違い、来月も入る見込みとして数えられる。',
    here: '買い切り（Top-up）は含めない。翌月も入る保証が無いため。',
  },
  arr: {
    name: '年換算の額',
    abbr: 'ARR',
    reading: 'エーアールアール',
    fullName: 'Annual Recurring Revenue',
    meaning: 'いまの MRR が1年続いた場合の額。',
    formula: 'MRR × 12',
    why: '事業の規模を年単位で表す共通語。',
    here: 'あくまで「いまの状態が続けば」の数字で、実績ではない。',
  },
  arpu: {
    name: '1人あたりの売上',
    abbr: 'ARPU',
    reading: 'アープ',
    fullName: 'Average Revenue Per User',
    meaning: '登録者1人あたりの売上。',
    formula: '期間の売上 ÷ 登録者数（分母は期間で切らない全登録者）',
    why: '人を増やす価値がいくらかを表す。',
    here: '無料の人も母数に入る。有料の人だけを見たいときは ARPPU を使う。読みは「エーアールピーユー」とも言う。',
  },
  arppu: {
    name: '有料1人あたりの売上',
    abbr: 'ARPPU',
    reading: 'アープー',
    fullName: 'Average Revenue Per Paying User',
    meaning: '支払っている人1人あたりの売上。',
    formula: '期間の売上 ÷ 支払っている人の数（分母はいま契約が有効な人）',
    why: '価格設計が効いているかを見る。LTV の土台にもなる。',
    here: '支払っている人が0人のときは割り算ができないので「算出不可」と出す。読みは「エーアールピーピーユー」とも言う。',
  },
  churn: {
    name: '解約率',
    abbr: 'Churn',
    reading: 'チャーン',
    fullName: 'Churn Rate',
    meaning: '期間の初めにいた契約者のうち、期間内に解約した割合。',
    formula: '期間内の解約数 ÷ 期間の初めの契約数 × 100',
    why: '入口をいくら広げても、ここが大きいと積み上がらない。',
    here: '期間の初めに契約が無いときは率を出さない。0% と書くと、解約が無いのか契約が無いのかが読めないため。',
  },
  aiCost: {
    name: 'AI の原価',
    abbr: 'AI Cost',
    fullName: 'AI Cost',
    meaning: '画像生成と文章生成にかかった費用の見積り。',
    formula: '画像原価 + 文章原価（それぞれ 呼び出し回数 × 単価 × 為替）',
    why: 'ここが売上を超えると、使われるほど損をする。',
    here: '回数は正確（image_usages / ai_usages）だが、単価は設定値なのでそこが誤差になる。',
  },
  grossProfit: {
    name: '粗利',
    abbr: 'Gross Profit',
    reading: 'グロスプロフィット',
    fullName: 'Gross Profit',
    meaning: '売上から、売るために直接かかった費用を引いた額。',
    formula: '売上 −（決済手数料 + 画像原価 + 文章原価 + インフラ費（期間配賦））',
    why: '事業として成り立つかを決める。売上だけでは分からない。',
    here: '収支ページと同じ計算を使っている。人件費は含めていない。インフラ費は使った量ではなく月額の固定費を期間の日数ぶんへ配ったもので、売上が0でも出ていく。',
  },
  grossMargin: {
    name: '粗利率',
    abbr: 'Gross Margin',
    reading: 'グロスマージン',
    fullName: 'Gross Margin',
    meaning: '売上のうち、どれだけが粗利として残るか。',
    formula: '粗利 ÷ 売上 × 100',
    why: '規模が変わっても比べられる。値段と原価の関係が健全かを見る。',
    here: '売上が0のときは割り算ができないので「算出不可」と出す。0% と書くと、稼いだのに残らなかったように見えるため。',
  },
  ltv: {
    name: '顧客生涯価値',
    abbr: 'LTV',
    reading: 'エルティーブイ',
    fullName: 'Lifetime Value',
    meaning: '1人の利用者が、使い続ける間にもたらす売上の合計。',
    formula: 'ARPPU × 平均継続月数',
    why: '獲得にいくらまで使えるかを決める基準になる（CAC と比べて使う）。',
    here: '解約がまだ起きていないため、平均継続月数は契約開始からの経過月数で代用している。母数も小さく、参考値としてしか使えない。',
  },
} as const satisfies Record<string, MetricDefinition>


export type MetricKey = keyof typeof METRIC_GLOSSARY

/**
 * 1件を引く。
 * `as const` のままだと項目ごとに別の型になり、reading の有無で扱いが分かれる。
 * 共通の形（MetricDefinition）に戻してから使う。
 */
export function metricDefinition(key: MetricKey): MetricDefinition {
  return METRIC_GLOSSARY[key]
}

/** カードの見出しに出す表記。読み方があれば括弧で添える */
export function metricLabel(key: MetricKey): string {
  const { abbr, reading } = metricDefinition(key)
  return reading ? `${abbr}（${reading}）` : abbr
}
