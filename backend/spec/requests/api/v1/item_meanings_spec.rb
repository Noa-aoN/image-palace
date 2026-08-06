require "rails_helper"

RSpec.describe "Api::V1::Meanings", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, :completed, user: user, title: "アポロ") }

  def add_meaning(definition, **attrs)
    item.meanings.create!({ language_code: "ja", definition: definition }.merge(attrs))
  end

  describe "POST /api/v1/items/:item_id/meanings" do
    it "認証なしでは 401" do
      post "/api/v1/items/#{item.id}/meanings", params: { meaning: { definition: "x" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "意味・説明を足す" do
      post "/api/v1/items/#{item.id}/meanings",
           params: { meaning: { definition: "ギリシャ神話の神", detail_level: "brief" } }, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["definition"]).to eq("ギリシャ神話の神")
      expect(json_response["detail_level"]).to eq("brief")
      expect(item.meanings.count).to eq(1)
    end

    it "足すたびに末尾へ並ぶ" do
      post "/api/v1/items/#{item.id}/meanings", params: { meaning: { definition: "1つめ" } }, headers: headers
      post "/api/v1/items/#{item.id}/meanings", params: { meaning: { definition: "2つめ" } }, headers: headers

      expect(item.meanings.ordered.map(&:definition)).to eq([ "1つめ", "2つめ" ])
    end

    it "言語を指定できる（未指定は ja）" do
      post "/api/v1/items/#{item.id}/meanings",
           params: { meaning: { definition: "Greek god", language_code: "en" } }, headers: headers

      expect(json_response["language_code"]).to eq("en")
    end

    it "上限を超えたら 422" do
      described_max = Api::V1::MeaningsController::MAX_PER_ITEM
      described_max.times { |i| add_meaning("説明#{i}") }

      post "/api/v1/items/#{item.id}/meanings", params: { meaning: { definition: "あふれる" } }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(item.meanings.count).to eq(described_max)
    end

    it "空の説明は 422" do
      post "/api/v1/items/#{item.id}/meanings", params: { meaning: { definition: "" } }, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "他ユーザーのカードには足せない" do
      other = create(:item, user: create(:user, :confirmed))

      post "/api/v1/items/#{other.id}/meanings", params: { meaning: { definition: "x" } }, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/items/:item_id/meanings/:id" do
    it "書き換える" do
      meaning = add_meaning("むかしの説明")

      patch "/api/v1/items/#{item.id}/meanings/#{meaning.id}",
            params: { meaning: { definition: "あたらしい説明" } }, headers: headers

      expect(response).to have_http_status(:success)
      expect(meaning.reload.definition).to eq("あたらしい説明")
    end

    it "説明を変えたら、以前のファクトチェック判定を捨てる" do
      meaning = add_meaning("むかしの説明", fact_check_status: "correct", fact_checked_at: Time.current)

      patch "/api/v1/items/#{item.id}/meanings/#{meaning.id}",
            params: { meaning: { definition: "あたらしい説明" } }, headers: headers

      expect(meaning.reload.fact_check_status).to be_nil
      expect(meaning.fact_checked_at).to be_nil
    end

    it "説明が同じなら判定は残す（例文だけ直したときに消さない）" do
      meaning = add_meaning("説明", fact_check_status: "correct", fact_checked_at: Time.current)

      patch "/api/v1/items/#{item.id}/meanings/#{meaning.id}",
            params: { meaning: { definition: "説明", example_sentence: "例文" } }, headers: headers

      expect(meaning.reload.fact_check_status).to eq("correct")
    end
  end

  describe "DELETE /api/v1/items/:item_id/meanings/:id" do
    it "消す" do
      meaning = add_meaning("消される説明")

      delete "/api/v1/items/#{item.id}/meanings/#{meaning.id}", headers: headers

      expect(response).to have_http_status(:no_content)
      expect(item.meanings.count).to eq(0)
    end

    it "他ユーザーのカードのものは消せない" do
      other = create(:item, user: create(:user, :confirmed))
      foreign = other.meanings.create!(language_code: "ja", definition: "よその説明")

      delete "/api/v1/items/#{other.id}/meanings/#{foreign.id}", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(foreign.reload).to be_present
    end
  end

  describe "PATCH /api/v1/items/:item_id/meanings/reorder" do
    it "渡した順に並べ替える" do
      a = add_meaning("A")
      b = add_meaning("B")
      c = add_meaning("C")

      patch "/api/v1/items/#{item.id}/meanings/reorder", params: { ids: [ c.id, a.id, b.id ] }, headers: headers

      expect(response).to have_http_status(:success)
      expect(item.meanings.ordered.map(&:definition)).to eq([ "C", "A", "B" ])
    end

    it "他人のカードの id が混ざっても、自分のカードのぶんだけ動かす" do
      a = add_meaning("A")
      b = add_meaning("B")
      foreign = create(:item, user: create(:user, :confirmed)).meanings.create!(language_code: "ja", definition: "よそ")

      patch "/api/v1/items/#{item.id}/meanings/reorder", params: { ids: [ foreign.id, b.id, a.id ] }, headers: headers

      expect(response).to have_http_status(:success)
      expect(item.meanings.ordered.map(&:definition)).to eq([ "B", "A" ])
      expect(foreign.reload.position).to eq(0)
    end
  end

  describe "カード詳細の meanings" do
    it "並び順どおりに全件返る（代表の1件は据え置き）" do
      add_meaning("1つめ")
      add_meaning("2つめ")

      get "/api/v1/items/#{item.id}", headers: headers

      expect(json_response["meanings"].map { |m| m["definition"] }).to eq([ "1つめ", "2つめ" ])
      expect(json_response["meaning"]).to eq("1つめ")
    end
  end
end
