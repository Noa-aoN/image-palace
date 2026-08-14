require "rails_helper"

# 正式公開のはじめに、どの買い切りを並べるか。
#
# クレジットの寿命は出どころによらず3か月（1つの決まりを保つ）。
# **大きい束ほど、期限のほうが先に来る。** 使い切れない量を、1枚あたりの安さだけで
# 選ばせると、あとで損に気づくことになる。
#
# 並べないだけで、消しはしない。使われ方が見えたら戻せる形にしておく。
RSpec.describe "並べる買い切り" do
  let(:catalog) { Billing::Catalog }

  describe "並び" do
    it "書いていない行は並べる（既存の行に手を入れずに済む）" do
      expect(catalog.listed?({ name: "topup_10" })).to be(true)
    end

    it "並べないと書いた行は並べない" do
      expect(catalog.listed?({ name: "x", listed: false })).to be(false)
    end

    it "並べる買い切りは、3か月で使い切れる速さに収まる" do
      # 本番の実測（2026-08-14・直近90日）で最も多い人が月24枚。
      # やや活発な人が届く範囲として、月40枚を上限に置く
      catalog.listed_topups.each do |row|
        pace = catalog.monthly_pace(row[:credits])

        expect(pace).to be <= 40, "#{row[:name]} は月#{pace}枚。3か月では使い切れない"
      end
    end

    it "大きい束は、定義を残したまま外してある（あとで戻せる）" do
      hidden = catalog::TOPUPS.reject { |row| catalog.listed?(row) }.map { |row| row[:name] }

      expect(hidden).to contain_exactly("topup_300", "topup_1000")
      # 値段と枚数は消していない（戻すのは listed だけ）
      expect(catalog::TOPUPS.find { |row| row[:name] == "topup_1000" }[:price]).to eq(15_000)
    end

    it "月額プランは全部並べる（束の話であって、契約の話ではない）" do
      expect(catalog.subscription_rows).to all(include(active: true))
    end
  end

  describe "使い切る速さ" do
    it "量を期限で割って、切り上げる（足りない速さを出すと使い切れない）" do
      expect(catalog.monthly_pace(300)).to eq(100)
      expect(catalog.monthly_pace(10)).to eq(4)
    end

    it "画面に出している有効期間と同じ数で割る（規約と食い違わせない）" do
      expect(catalog.monthly_pace(300)).to eq(catalog.monthly_pace(300, months: 3))
      expect(Billing::CreditExpiryPolicy.months).to eq(3)
    end

    it "0 や負の値でも壊れない" do
      expect(catalog.monthly_pace(0)).to eq(0)
      expect(catalog.monthly_pace(-5)).to eq(0)
    end
  end

  # 本番は毎回 seed が走る。DB で外すだけでは、次のデプロイで戻ってしまう
  describe "配り直しても戻らない" do
    before { load Rails.root.join("db/seeds.rb") }

    it "外した束は、seed のあとも並ばない" do
      expect(Plan.find_by(name: "topup_1000").active).to be(false)
      expect(Plan.find_by(name: "topup_300").active).to be(false)
    end

    it "並べる束は並ぶ" do
      expect(Plan.find_by(name: "topup_100").active).to be(true)
      expect(Plan.find_by(name: "standard").active).to be(true)
    end

    it "外した束にも、Stripe の値札は残す（戻すときに作り直さずに済む）" do
      plan = Plan.find_by(name: "topup_1000")

      expect(plan).to be_present
      expect(plan.price_cents).to eq(15_000)
      expect(plan.credits_per_period).to eq(1_000)
    end
  end

  describe "買う口" do
    let(:user) { create(:user, :confirmed) }
    let(:headers) { auth_headers_for(user) }

    before { load Rails.root.join("db/seeds.rb") }

    it "並べていない束は、料金の一覧に出ない", type: :request do
      get "/api/v1/billing/plans", headers: headers

      names = response.parsed_body["plans"].map { |plan| plan["name"] }
      expect(names).to include("topup_100")
      expect(names).not_to include("topup_300", "topup_1000")
    end

    it "並べていない束は、直に叩いても買えない", type: :request do
      post "/api/v1/billing/checkout", params: { plan: "topup_1000" }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    # 上の 404 が「口そのものが無い」ことによる 404 だと、何も確かめていないことになる
    it "並べている束は、同じ口で 404 にならない", type: :request do
      post "/api/v1/billing/checkout", params: { plan: "topup_100" }, headers: headers, as: :json

      expect(response).not_to have_http_status(:not_found)
    end
  end
end
