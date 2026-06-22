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

# Planのseedデータ（JPY はゼロ小数通貨のため price_cents には円をそのまま入れる）。
# stripe_price_id は Stripe Products/Prices 作成後に別途投入する。
plans_data = [
  { name: "free",      tier: "free",     kind: "subscription", interval: "month", price_cents: 0,     credits_per_period: 10 },
  { name: "standard",  tier: "standard", kind: "subscription", interval: "month", price_cents: 1480,  credits_per_period: 100 },
  { name: "pro",       tier: "pro",      kind: "subscription", interval: "month", price_cents: 3980,  credits_per_period: 500 },
  { name: "creator",   tier: "creator",  kind: "subscription", interval: "month", price_cents: 9800,  credits_per_period: 1500 },
  { name: "studio",    tier: "studio",   kind: "subscription", interval: "month", price_cents: 19800, credits_per_period: 4000 },
  { name: "topup_100", tier: "topup",    kind: "one_time",     interval: nil,     price_cents: 1200,  credits_per_period: 100 }
]

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

# テストユーザー（SEED_TEST_USER=1 が設定されている環境のみ作成）
if ENV["SEED_TEST_USER"] == "true"
  User.find_or_create_by!(email: "test@example.com") do |u|
    u.password = "password"
    u.password_confirmation = "password"
  end
end
