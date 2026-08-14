require "rails_helper"

# 自由な小見出しと、自由な指示で作る絵。
#
# カードの見出し語には縛られない。そのカードの中の一場面・対比・図解などを持てる。
# 絵を1枚作るので、カードの絵と同じだけクレジットを使う。
RSpec.describe "自由イメージ", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, :completed, user: user, item_type: item_type, title: "光合成") }
  let!(:definition) do
    user.property_definitions.create!(item_type: item_type, key: "scene_1", label: "場面",
                                      value_type: "free_image")
  end

  before do
    # 無料枠の配布を先に済ませる。呼び出しの中で配られると、
    # 引いた額と釣り合わなくなって「増えた」ように見える
    user.ensure_current_period_credits!
    user.grant_credits!(10 * Billing::POINTS_PER_CREDIT, kind: "campaign", expires_at: 1.month.from_now)
    allow(Moderation::PromptModerator).to receive(:call).and_return(double(allowed?: true))
  end

  def generate(params = {})
    post "/api/v1/items/#{item.id}/properties/#{definition.id}/free_image",
         params: { heading: "葉のなか", prompt: "葉緑体が光を受けている場面" }.merge(params),
         headers: headers, as: :json
  end

  describe "作る" do
    it "受け付けて、作る仕事を積む" do
      expect { generate }.to have_enqueued_job(GenerateFreeImageJob)

      expect(response).to have_http_status(:accepted)
    end

    it "小見出しと指示を先に残す（作っている間も何を頼んだか分かる）" do
      generate

      value = item.item_properties.first.typed_value
      expect(value["heading"]).to eq("葉のなか")
      expect(value["prompt"]).to eq("葉緑体が光を受けている場面")
      expect(value["status"]).to eq("pending")
    end

    it "1枚ぶんのクレジットを、積む前に引く" do
      expect { generate }.to change { user.reload.available_credit_points }
        .by(-Billing::CreditCost.call(kind: :free_image))
    end

    it "残高が足りなければ作らない" do
      user.credit_grants.update_all(remaining_points: 0)
      user.update!(subscription_credits: 0, topup_credits: 0)

      expect { generate }.not_to have_enqueued_job(GenerateFreeImageJob)
      expect(response).to have_http_status(:payment_required)
    end

    it "作っている間は、二重に受け付けない" do
      generate

      expect { generate }.not_to have_enqueued_job(GenerateFreeImageJob)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "受け取らないもの" do
    it "何を描くかが空なら断る（クレジットも減らない）" do
      expect { generate(prompt: "") }.not_to change { user.reload.available_credit_points }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "長すぎる指示は断る（そのまま費用と待ち時間になる）" do
      generate(prompt: "あ" * (ItemProperty::MAX_FREE_IMAGE_PROMPT + 1))

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "使えない言い方は断る" do
      allow(Moderation::PromptModerator).to receive(:call)
        .and_return(double(allowed?: false, category: "violence", term: "x"))

      expect { generate }.not_to change { user.reload.available_credit_points }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "自由イメージでない項目には作らない" do
      other = user.property_definitions.create!(item_type: item_type, key: "reading", label: "読み仮名",
                                                value_type: "text")

      post "/api/v1/items/#{item.id}/properties/#{other.id}/free_image",
           params: { prompt: "何か" }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "ほかの人のカードには作れない" do
      stranger = create(:user, :confirmed)

      post "/api/v1/items/#{item.id}/properties/#{definition.id}/free_image",
           params: { prompt: "何か" }, headers: auth_headers_for(stranger), as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "作り終えたあと" do
    it "同じ指示は作り直さない（世界で1回だけ作る）" do
      shared = SharedMedia.create!(normalized_prompt: "free_image:葉緑体が光を受けている場面",
                                   metadata: { "model" => "gpt-image-1" })
      shared.file.attach(io: StringIO.new("dummy"), filename: "a.webp", content_type: "image/webp")
      property = item.item_properties.create!(property_definition: definition)
      property.typed_value = { "heading" => "葉のなか", "prompt" => "葉緑体が光を受けている場面" }
      property.save!

      expect(GenerateImageService).not_to receive(:call)
      GenerateFreeImageJob.perform_now(property.id, "葉緑体が光を受けている場面")

      expect(property.reload.typed_value["status"]).to eq("completed")
      expect(property.typed_value["shared_media_id"]).to eq(shared.id)
    end

    it "書いた小見出しと指示は、作り直しても残る" do
      property = item.item_properties.create!(property_definition: definition)
      property.typed_value = { "heading" => "葉のなか", "prompt" => "場面" }
      property.save!

      shared = SharedMedia.create!(normalized_prompt: "free_image:場面", metadata: {})
      shared.file.attach(io: StringIO.new("dummy"), filename: "a.webp", content_type: "image/webp")
      GenerateFreeImageJob.perform_now(property.id, "場面")

      expect(property.reload.typed_value["heading"]).to eq("葉のなか")
    end
  end
end
