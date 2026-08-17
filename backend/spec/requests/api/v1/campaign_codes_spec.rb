require "rails_helper"

# 引き換えコード。運営が発行し、利用者が入力してクレジットを受け取る。
RSpec.describe "引き換えコード", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:admin_headers) { auth_headers_for(admin) }

  def make_code(**attrs)
    CampaignCode.create!({ code: "SPRING24", label: "春の配布", amount: 5 }.merge(attrs))
  end

  describe "GET /api/v1/campaign_codes" do
    # 引き換えは「押したら残高が増える」だけなので、記録が見えないと
    # 受け取ったのか打ち間違えたのかを後から確かめられない
    it "引き換えた記録を新しい順に返す" do
      user.grant_credits!(300, kind: "campaign", metadata: { "campaign_code" => "OLD" })
      user.grant_credits!(500, kind: "campaign", metadata: { "campaign_code" => "NEW" })
      # 引き換え以外の付与は混ぜない
      user.grant_credits!(100, kind: "trial")

      get "/api/v1/campaign_codes", headers: headers, as: :json

      rows = response.parsed_body.fetch("redemptions")
      expect(rows.map { |r| r["code"] }).to eq(%w[NEW OLD])
      expect(rows.first["credits"]).to eq(5.0)
      expect(response.parsed_body["has_more"]).to be(false)
    end

    it "件数を超えたら、次があることを伝える" do
      12.times { |i| user.grant_credits!(100, kind: "campaign", metadata: { "campaign_code" => "C#{i}" }) }

      get "/api/v1/campaign_codes", headers: headers, as: :json

      expect(response.parsed_body["redemptions"].size).to eq(Api::V1::CampaignCodesController::HISTORY_LIMIT)
      expect(response.parsed_body["has_more"]).to be(true)
    end

    it "他の人の記録は返さない" do
      create(:user, :confirmed).grant_credits!(100, kind: "campaign", metadata: { "campaign_code" => "OTHER" })

      get "/api/v1/campaign_codes", headers: headers, as: :json

      expect(response.parsed_body["redemptions"]).to be_empty
    end
  end

  describe "POST /api/v1/campaign_codes/redeem" do
    it "クレジットを受け取れる" do
      code = make_code
      user.ensure_current_period_credits!
      before_points = user.available_credit_points

      post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["credits"]).to eq(5.0)
      expect(user.reload.available_credit_points).to eq(before_points + 500)
      expect(code.redemptions.count).to eq(1)
    end

    # 利用者は小文字で打つし、コピペで前後に空白が付く
    it "大小と前後の空白を無視する" do
      make_code

      post "/api/v1/campaign_codes/redeem", params: { code: "  spring24 " }, headers: headers, as: :json

      expect(response).to have_http_status(:ok)
    end

    it "同じ人は2回受け取れない" do
      make_code
      post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json

      expect {
        post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json
      }.not_to change(CreditGrant, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"]).to include("受け取り済み")
    end

    # 実在するコードを総当たりで探せてしまうため、理由は区別しない
    it "存在しないコードと使えないコードで文面を変えない" do
      make_code(code: "EXPIRED1", expires_at: 1.hour.ago)

      post "/api/v1/campaign_codes/redeem", params: { code: "EXPIRED1" }, headers: headers, as: :json
      expired_message = response.parsed_body["error"]

      post "/api/v1/campaign_codes/redeem", params: { code: "NOSUCH99" }, headers: headers, as: :json

      expect(response.parsed_body["error"]).to eq(expired_message)
    end

    it "開始前は受け取れない" do
      make_code(starts_at: 1.day.from_now)

      post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "無効にしたコードは受け取れない" do
      make_code(enabled: false)

      post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 外の判定から書き込みまでの間に期限が切れることがある。
    # ロックの中で見直していないと、切れたあとの1枚が通ってしまう
    it "受け取る途中で期限が切れたら、配らない" do
      code = make_code(expires_at: 1.hour.from_now)

      travel_to(2.hours.from_now) do
        post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json
      end

      expect(response).to have_http_status(:unprocessable_entity)
      expect(code.reload.redemptions.count).to eq(0)
      expect(user.credit_transactions.where(kind: "grant")).to be_empty
    end

    it "期限切れは、有効のままでも受け取れない状態として扱う" do
      code = make_code(expires_at: 1.hour.ago, enabled: true)

      expect(code.enabled).to be true
      expect(code.available?).to be false
      expect(code.status).to eq("expired")
      expect(CampaignCode.redeemable).not_to include(code)
    end

    it "総数の上限に達したら受け取れない" do
      code = make_code(max_redemptions: 1)
      code.redemptions.create!(user: create(:user, :confirmed), points: 500)

      post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(code.reload.redemptions.count).to eq(1)
    end

    it "有効期限を指定すると、その日数で切れるクレジットになる" do
      make_code(credit_valid_days: 7)

      post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json

      grant = user.credit_grants.find_by(kind: "campaign")
      expect(grant.expires_at).to be_within(1.minute).of(7.days.from_now)
    end

    # 無料枠のブレーカーは自動で配るぶんの見張り。ここに混ぜると、
    # 大きめのキャンペーンが新規登録のお試し枠を食い潰す
    it "無料枠のブレーカーには縛られない（配りすぎは人数上限で止める）" do
      make_code
      allow(Billing::FreeGrantGuard).to receive(:allow?).and_return(false)

      expect {
        post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, headers: headers, as: :json
      }.to change(CreditGrant, :count).by(1)

      expect(response).to have_http_status(:ok)
    end

    it "認証が要る" do
      make_code

      post "/api/v1/campaign_codes/redeem", params: { code: "SPRING24" }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "管理画面" do
    it "発行できる" do
      post "/api/v1/admin/campaign_codes",
           params: { campaign_code: { label: "夏の配布", amount: 3, max_redemptions: 100 } },
           headers: admin_headers, as: :json

      expect(response).to have_http_status(:created)
      expect(response.parsed_body.dig("code", "code")).to match(CampaignCode::CODE_FORMAT)
      expect(CampaignCode.count).to eq(1)
    end

    it "受け取り数と付与したクレジット、受け取り率を返す" do
      code = make_code(max_redemptions: 4)
      2.times { code.redemptions.create!(user: create(:user, :confirmed), points: 500) }

      get "/api/v1/admin/campaign_codes", headers: admin_headers

      row = response.parsed_body["codes"].first
      expect(row["redeemed_count"]).to eq(2)
      expect(row["granted_credits"]).to eq(10.0)
      expect(row["redemption_rate"]).to eq(0.5)
    end

    # 分母が無いのに 0 を返すと「誰も受け取っていない」と読めてしまう
    it "上限を決めていないコードの受け取り率は空で返す" do
      make_code(max_redemptions: nil)

      get "/api/v1/admin/campaign_codes", headers: admin_headers

      expect(response.parsed_body["codes"].first["redemption_rate"]).to be_nil
    end

    it "受け取られたコードは削除できない" do
      code = make_code
      code.redemptions.create!(user: user, points: 500)

      delete "/api/v1/admin/campaign_codes/#{code.id}", headers: admin_headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(CampaignCode.exists?(code.id)).to be(true)
    end

    it "誰も受け取っていなければ削除できる" do
      code = make_code

      delete "/api/v1/admin/campaign_codes/#{code.id}", headers: admin_headers

      expect(response).to have_http_status(:no_content)
      expect(CampaignCode.exists?(code.id)).to be(false)
    end

    it "運営でなければ触れない" do
      get "/api/v1/admin/campaign_codes", headers: headers

      expect(response).to have_http_status(:forbidden)
    end

    it "アイテムの配布はまだ受け付けない" do
      post "/api/v1/admin/campaign_codes",
           params: { campaign_code: { label: "箱を配る", amount: 1, reward_type: "item", item_kind: "box" } },
           headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
