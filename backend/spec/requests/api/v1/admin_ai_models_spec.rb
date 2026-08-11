require "rails_helper"

# AI モデルの登録簿。原価・消費クレジット・表示・用途・上限を1か所で扱う。
RSpec.describe "AIモデルの管理", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:admin) { create(:user, :confirmed, role: "admin") }
  let(:admin_headers) { auth_headers_for(admin) }

  describe "GET /api/v1/admin/ai_models" do
    it "組み込みを取り込んで返す" do
      get "/api/v1/admin/ai_models", headers: admin_headers

      expect(response).to have_http_status(:ok)
      keys = response.parsed_body["models"].map { |m| m["key"] }
      expect(keys).to include(*AiModel::BUILTIN_KEYS)
    end

    # 有効にしていても鍵が無ければ実際には使えない。そこが分からないと、
    # 「有効なのに出てこない」と見える
    it "鍵が入っているかを併せて返す" do
      get "/api/v1/admin/ai_models", headers: admin_headers

      row = response.parsed_body["models"].find { |m| m["key"] == "openai" }
      expect(row).to include("available", "credit_points", "unit_cost_usd", "purposes")
    end

    it "運営でなければ触れない" do
      get "/api/v1/admin/ai_models", headers: headers

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "登録" do
    it "モデルを足せる" do
      post "/api/v1/admin/ai_models",
           params: { ai_model: { key: "flux-pro", kind: "image", provider: "flux",
                                 model_id: "fal-ai/flux-pro", label: "きれい",
                                 credit_points: 300, unit_cost_usd: 0.05 } },
           headers: admin_headers, as: :json

      expect(response).to have_http_status(:created)
      expect(AiModel.find_by(key: "flux-pro").credit_points).to eq(300)
    end

    # 実装の無い provider を登録できてしまうと、選んだ瞬間に落ちる
    it "実装の無いプロバイダは登録できない" do
      post "/api/v1/admin/ai_models",
           params: { ai_model: { key: "unknown-one", kind: "image", provider: "nope",
                                 model_id: "x", label: "謎" } },
           headers: admin_headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "更新" do
    it "既定はその種類に1つだけになる" do
      AiModel.registry
      flux = AiModel.find_by(key: "flux")

      patch "/api/v1/admin/ai_models/#{flux.id}",
            params: { ai_model: { default_for_kind: true } }, headers: admin_headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(AiModel.of_kind("image").where(default_for_kind: true).pluck(:key)).to eq([ "flux" ])
    end

    it "操作を監査ログに残す" do
      AiModel.registry
      model = AiModel.find_by(key: "openai")

      expect {
        patch "/api/v1/admin/ai_models/#{model.id}",
              params: { ai_model: { credit_points: 200 } }, headers: admin_headers, as: :json
      }.to change { AdminAuditLog.where(action: "ai_model_update").count }.by(1)
    end
  end

  describe "削除" do
    # コードが key を参照しているので、消えると選択が壊れる
    it "組み込みは消せない" do
      AiModel.registry
      model = AiModel.find_by(key: "openai")

      delete "/api/v1/admin/ai_models/#{model.id}", headers: admin_headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(AiModel.exists?(model.id)).to be(true)
    end

    it "自分で足したものは消せる" do
      model = AiModel.create!(key: "extra", kind: "image", provider: "openai",
                              model_id: "gpt-image-1", label: "予備")

      delete "/api/v1/admin/ai_models/#{model.id}", headers: admin_headers

      expect(response).to have_http_status(:no_content)
    end
  end

  describe "使用率" do
    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("OPENAI_API_KEY").and_return("test-key")
      AiModel.registry
    end

    it "直近の使用回数と割合を返す" do
      3.times { ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1") }
      ImageUsage.record!(kind: "item", provider: "flux", model: "fal-ai/flux/schnell")

      get "/api/v1/admin/ai_models", headers: admin_headers

      openai = response.parsed_body["models"].find { |m| m["key"] == "openai" }
      expect(openai["used_recently"]).to eq(3)
      expect(openai["share"]).to eq(0.75)
    end

    # 0% と書くと、使われていないのか分母が無いのかが分からない
    it "一度も使われていない種類の割合は空で返す" do
      get "/api/v1/admin/ai_models", headers: admin_headers

      openai = response.parsed_body["models"].find { |m| m["key"] == "openai" }
      expect(openai["used_recently"]).to eq(0)
      expect(openai["share"]).to be_nil
    end

    it "キャッシュで済んだ回数も分けて返す" do
      ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1")
      ImageUsage.record!(kind: "item", provider: "openai", model: "gpt-image-1", cached: true)

      get "/api/v1/admin/ai_models", headers: admin_headers

      openai = response.parsed_body["models"].find { |m| m["key"] == "openai" }
      expect(openai["used_recently"]).to eq(2)
      expect(openai["cached_recently"]).to eq(1)
    end
  end

  describe "設定が実際に効くこと" do
    # 「使える」の判定は鍵の有無を見る。CI には鍵が無いので、ここで入れておく
    # （入れないと、用途に合っていても選べないほうの理由で落ちる）
    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("OPENAI_API_KEY").and_return("test-key")
      AiModel.registry
    end

    it "隠したモデルは選択肢から消える" do
      AiModel.find_by(key: "openai").update!(visible: false)

      expect(GenerateImageService.available_choices.map(&:key)).not_to include("openai")
    end

    it "止めたモデルは選択肢から消える" do
      AiModel.find_by(key: "openai").update!(enabled: false)

      expect(GenerateImageService.available_choices.map(&:key)).not_to include("openai")
    end

    # 原価の高いモデルを足したときに、消費クレジットの上げ忘れで粗利だけ減るのを防ぐ
    it "消費クレジットはモデルごとの設定に従う" do
      AiModel.find_by(key: "openai").update!(credit_points: 250)

      expect(Billing::CreditCost.call(kind: :item_generation, model_key: "openai")).to eq(250)
    end

    it "設定が無ければ既定（1クレジット）に落ちる" do
      expect(Billing::CreditCost.call(kind: :item_generation)).to eq(Billing::POINTS_PER_CREDIT)
    end

    it "用途から外れているモデルは使われない" do
      AiModel.find_by(key: "openai").update!(purposes: [ "avatar" ])

      expect(GenerateImageService.usable_key("openai", purpose: "item")).to be_nil
      expect(GenerateImageService.usable_key("openai", purpose: "avatar")).to eq("openai")
    end

    # 上限に当たった瞬間に絵が作れなくなると困るので、既定へ落とす（失敗させない）
    it "1日の上限に達したモデルは既定に落ちる" do
      model = AiModel.find_by(key: "openai")
      model.update!(daily_limit: 1)
      ImageUsage.record!(kind: "item", provider: "openai", model: model.model_id)

      expect(GenerateImageService.usable_key("openai", purpose: "item")).to be_nil
    end

    it "原価は登録簿からも拾える" do
      AiModel.create!(key: "newcomer", kind: "image", provider: "openai",
                      model_id: "brand-new-image", label: "新顔", unit_cost_usd: 0.09)

      expect(CostParameter.table.image_unit_usd(model: "brand-new-image")).to eq(0.09)
    end
  end
end
