require "rails_helper"

RSpec.describe "Api::V1::Items", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  describe "認証ガード" do
    it "GET /api/v1/items returns 401 without auth headers" do
      get "/api/v1/items", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "POST /api/v1/items returns 401 without auth headers" do
      post "/api/v1/items", params: { item: { title: "x" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "GET /api/v1/items/summary returns 401 without auth headers" do
      get "/api/v1/items/summary", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "GET /api/v1/items/:id returns 401 without auth headers" do
      item = create(:item, user: user)
      get "/api/v1/items/#{item.id}", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "POST /api/v1/items/:id/retry returns 401 without auth headers" do
      item = create(:item, user: user)
      post "/api/v1/items/#{item.id}/retry", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/items" do
    it "enqueues image generation and returns pending item" do
      expect {
        expect {
          post "/api/v1/items", params: { item: { title: "富士山" } }, headers: headers, as: :json
        }.to have_enqueued_job(GenerateImageJob)
      }.to change { user.items.count }.by(1)

      expect(response).to have_http_status(:accepted)
      created_item = user.items.order(created_at: :desc).first
      expect(created_item.title).to eq("富士山")
      expect(created_item.generation_status).to eq("pending")
      expect(created_item.generation_error).to be_nil
      expect(json_response["id"]).to eq(created_item.id)
      expect(json_response["generation_status"]).to eq("pending")
      expect(json_response["generation_error"]).to be_nil
    end

    it "returns validation error when title is too long" do
      expect {
        post "/api/v1/items",
          params: { item: { title: "あ" * (Item::MAX_TITLE_LENGTH + 1) } },
          headers: headers, as: :json
      }.not_to have_enqueued_job(GenerateImageJob)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end

    it "returns validation error when monthly limit is exceeded" do
      freeze_time do
        Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH.times do |index|
          user.items.create!(
            title: "card-#{index}",
            item_type: item_type,
            generation_status: "completed",
            created_at: Time.current,
            updated_at: Time.current
          )
        end

        expect {
          post "/api/v1/items", params: { item: { title: "101枚目" } }, headers: headers, as: :json
        }.not_to have_enqueued_job
      end

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to eq("今月の生成枚数の上限（100枚）に達しました")
    end
  end

  describe "GET /api/v1/items" do
    it "returns items ordered by created_at desc with generation fields" do
      older_item = user.items.create!(
        title: "古いカード",
        item_type: item_type,
        generation_status: "pending",
        created_at: 2.days.ago,
        updated_at: 2.days.ago
      )
      newer_item = user.items.create!(
        title: "新しいカード",
        item_type: item_type,
        generation_status: "failed",
        metadata: {
          "generation_error" => "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。",
          "generation_error_code" => "Faraday::BadRequestError"
        },
        created_at: 1.day.ago,
        updated_at: 1.day.ago
      )

      get "/api/v1/items", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      items = json_response["items"]
      expect(items.map { |item| item["id"] }).to eq([ newer_item.id, older_item.id ])
      expect(items.first["generation_status"]).to eq("failed")
      expect(items.first["generation_error"]).to eq("入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。")
      expect(items.last["generation_error"]).to be_nil
    end

    it "does not return other users items" do
      own_item = user.items.create!(title: "自分のカード", item_type: item_type, generation_status: "completed")
      other_user = create(:user, :confirmed)
      other_item = other_user.items.create!(title: "他人のカード", item_type: item_type, generation_status: "completed")

      get "/api/v1/items", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      item_ids = json_response.fetch("items").map { |item| item.fetch("id") }
      expect(item_ids).to include(own_item.id)
      expect(item_ids).not_to include(other_item.id)
    end
  end

  describe "GET /api/v1/items/summary" do
    it "returns counts grouped by generation status" do
      user.items.create!(title: "pending", item_type: item_type, generation_status: "pending")
      user.items.create!(title: "processing", item_type: item_type, generation_status: "processing")
      user.items.create!(title: "failed", item_type: item_type, generation_status: "failed")
      user.items.create!(title: "completed", item_type: item_type, generation_status: "completed")

      get "/api/v1/items/summary", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["total_count"]).to eq(4)
      expect(json_response["pending_count"]).to eq(1)
      expect(json_response["processing_count"]).to eq(1)
      expect(json_response["failed_count"]).to eq(1)
    end
  end

  describe "GET /api/v1/items/:id" do
    it "rejects access to another users item" do
      other_user = create(:user, :confirmed)
      other_item = other_user.items.create!(
        title: "他人のカード",
        item_type: item_type,
        generation_status: "completed"
      )

      get "/api/v1/items/#{other_item.id}", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(json_response["error"]).to eq("Not found")
    end

    it "returns generation_error for failed items" do
      item = user.items.create!(
        title: "aaaaaaa",
        item_type: item_type,
        generation_status: "failed",
        metadata: {
          "generation_error" => "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。",
          "generation_error_code" => "Faraday::BadRequestError"
        }
      )

      get "/api/v1/items/#{item.id}", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["generation_status"]).to eq("failed")
      expect(json_response["generation_error"]).to eq("入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。")
    end
  end

  describe "POST /api/v1/items/:id/retry" do
    it "rejects items that are not failed" do
      item = user.items.create!(title: "富士山", item_type: item_type, generation_status: "completed")

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.not_to have_enqueued_job

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to eq("failed 状態のカードのみ再生成できます")
    end

    it "clears generation_error and enqueues image generation" do
      item = user.items.create!(
        title: "aaaaaaa",
        item_type: item_type,
        generation_status: "failed",
        metadata: {
          "generation_error" => "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。",
          "generation_error_code" => "Faraday::BadRequestError"
        }
      )

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.to have_enqueued_job(GenerateImageJob)

      expect(response).to have_http_status(:accepted)
      expect(item.reload.generation_status).to eq("pending")
      expect(item.generation_error).to be_nil
      expect(item.generation_error_code).to be_nil
      expect(json_response["generation_error"]).to be_nil
      expect(enqueued_jobs.last[:args][0]).to eq(item.id)
    end
  end
end
