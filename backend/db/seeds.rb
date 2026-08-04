# ItemTypeのseedデータ
item_types_data = [
  { name: "term", label: "単語" },
  { name: "concept", label: "概念" },
  { name: "entity", label: "実体" },
  { name: "person", label: "人物" },
  { name: "event", label: "出来事" }
]

item_types_data.each do |data|
  ItemType.find_or_create_by!(name: data[:name]) do |it|
    it.label = data[:label]
  end
end

# Plan の内容は Billing::Catalog に集約している。
# 「上位ほど1枚あたりが安い」「原価を割らない」といった性質はテストで守っているので、
# 価格を変えるときは Catalog を直すこと（ここには書かない）。
plans_data = Billing::Catalog.plans

plans_data.each do |data|
  plan = Plan.find_or_initialize_by(name: data[:name])
  plan.update!(
    tier: data[:tier],
    kind: data[:kind],
    interval: data[:interval],
    price_cents: data[:price_cents],
    currency: "jpy",
    credits_per_period: data[:credits_per_period],
    active: true
  )
end

# 開発用テストユーザー（SEED_TEST_USER=true の環境のみ作成）。
#
# 本番では ENV の指定に関係なく絶対に作らない。認証情報がリポジトリに書かれている以上、
# 本番に存在させてはいけないため、フラグの設定ミスでも作られないようここで二重に止める。
# （本番デプロイは release_command で db:seed を毎回実行するため、フラグ頼みでは危険）
if ENV["SEED_TEST_USER"] == "true"
  if Rails.env.production?
    Rails.logger.warn("[seeds] SEED_TEST_USER が本番で指定されましたが、テストユーザーは作成しません")
  else
    User.find_or_create_by!(email: "test@example.com") do |u|
      u.password = "password"
      u.password_confirmation = "password"
    end
  end
end
