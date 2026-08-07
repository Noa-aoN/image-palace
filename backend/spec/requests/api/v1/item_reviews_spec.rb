require "rails_helper"

RSpec.describe "Api::V1::ItemReviews", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, :completed, user: user, title: "光合成") }
  let(:other_item) { create(:item, :completed, user: user, title: "呼吸") }

  describe "POST /api/v1/item_reviews" do
    it "認証なしでは 401" do
      post "/api/v1/item_reviews", params: { reviews: [] }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "1回の学習ぶんをまとめて記録する" do
      post "/api/v1/item_reviews", params: {
        reviews: [
          { item_id: item.id, result: "correct", mode: "quiz" },
          { item_id: other_item.id, result: "incorrect", mode: "quiz" }
        ]
      }, headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response["recorded"]).to eq(2)
      expect(ItemReview.count).to eq(2)
    end

    it "同じカードを何度確認しても、そのぶん行が増える" do
      3.times do
        post "/api/v1/item_reviews",
             params: { reviews: [ { item_id: item.id, result: "seen", mode: "practice" } ] }, headers: headers
      end

      expect(item.item_reviews.count).to eq(3)
    end

    it "他ユーザーのカードは黙って捨てる（記録ごと失敗させない）" do
      foreign = create(:item, user: create(:user, :confirmed))

      post "/api/v1/item_reviews", params: {
        reviews: [
          { item_id: foreign.id, result: "correct", mode: "quiz" },
          { item_id: item.id, result: "correct", mode: "quiz" }
        ]
      }, headers: headers

      expect(json_response["recorded"]).to eq(1)
      expect(ItemReview.pluck(:item_id)).to eq([ item.id ])
    end

    it "知らない結果や種別は捨てる" do
      post "/api/v1/item_reviews", params: {
        reviews: [
          { item_id: item.id, result: "bogus", mode: "quiz" },
          { item_id: item.id, result: "correct", mode: "bogus" },
          { item_id: item.id, result: "correct", mode: "quiz" }
        ]
      }, headers: headers

      expect(json_response["recorded"]).to eq(1)
    end

    it "1件も残らなければ 422" do
      post "/api/v1/item_reviews", params: { reviews: [] }, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "1回で受ける件数に歯止めがある" do
      rows = Array.new(300) { { item_id: item.id, result: "seen", mode: "practice" } }

      post "/api/v1/item_reviews", params: { reviews: rows }, headers: headers

      expect(json_response["recorded"]).to eq(Api::V1::ItemReviewsController::MAX_PER_REQUEST)
    end
  end

  describe "GET /api/v1/items/:id/reviews/summary" do
    it "確認回数・最終確認日・直近の正答を返す" do
      item.item_reviews.create!(user: user, result: "seen", mode: "practice", reviewed_at: 2.days.ago)
      item.item_reviews.create!(user: user, result: "incorrect", mode: "quiz", reviewed_at: 1.day.ago)
      item.item_reviews.create!(user: user, result: "correct", mode: "quiz", reviewed_at: Time.current)

      get "/api/v1/items/#{item.id}/reviews/summary", headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response["count"]).to eq(3)
      expect(json_response["last_reviewed_at"]).to be_present
      # 見返し（seen）は正答率に混ぜない。混ぜると見返すほど率が動いて意味を成さない
      expect(json_response["recent_graded_count"]).to eq(2)
      expect(json_response["recent_correct_count"]).to eq(1)
    end

    it "記録が無ければ 0 で返る" do
      get "/api/v1/items/#{item.id}/reviews/summary", headers: headers

      expect(json_response["count"]).to eq(0)
      expect(json_response["last_reviewed_at"]).to be_nil
    end

    it "他ユーザーのカードは 404" do
      foreign = create(:item, user: create(:user, :confirmed))

      get "/api/v1/items/#{foreign.id}/reviews/summary", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
