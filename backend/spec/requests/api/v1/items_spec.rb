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

    it "PATCH /api/v1/items/:id returns 401 without auth headers" do
      item = create(:item, user: user)
      patch "/api/v1/items/#{item.id}", params: { item: { title: "x" } }, as: :json
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

    it "returns an error and enqueues nothing when the user is out of credits" do
      # 無料枠を付与してから 0 にし、残高切れを再現する
      user.ensure_current_period_credits!
      user.update!(subscription_credits: 0, topup_credits: 0)

      expect {
        post "/api/v1/items", params: { item: { title: "no-credit" } }, headers: headers, as: :json
      }.not_to have_enqueued_job

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to eq("クレジットが不足しています")
    end

    it "不適切なプロンプトは 422 を返し、アイテムを作らずジョブも積まない" do
      expect {
        post "/api/v1/items", params: { item: { title: "a cute loli" } }, headers: headers, as: :json
      }.not_to have_enqueued_job(GenerateImageJob)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to be_present
      expect(user.items.count).to eq(0)
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

    it "status=needs_correction でファクトチェック要確認のカードだけ返す" do
      flagged = user.items.create!(title: "トリトニウム", item_type: item_type, generation_status: "completed")
      flagged.meanings.create!(definition: "説明", language_code: "ja", fact_check_status: "doubtful")
      ok = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      ok.meanings.create!(definition: "説明", language_code: "ja", fact_check_status: "correct")
      user.items.create!(title: "未チェック", item_type: item_type, generation_status: "completed")

      get "/api/v1/items", params: { status: "needs_correction" }, headers: headers

      expect(response).to have_http_status(:success)
      ids = json_response["items"].map { |i| i["id"] }
      expect(ids).to contain_exactly(flagged.id)
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

    it "includes pagination meta" do
      user.items.create!(title: "カード", item_type: item_type, generation_status: "completed")

      get "/api/v1/items", headers: headers, as: :json

      meta = json_response.fetch("meta")
      expect(meta["page"]).to eq(1)
      expect(meta["per"]).to eq(24)
      expect(meta["total_count"]).to eq(1)
      expect(meta["total_pages"]).to eq(1)
    end

    it "paginates with page and per params" do
      5.times do |i|
        user.items.create!(
          title: "カード#{i}",
          item_type: item_type,
          generation_status: "completed",
          created_at: i.days.ago
        )
      end

      get "/api/v1/items", params: { page: 2, per: 2 }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response.fetch("items").size).to eq(2)
      meta = json_response.fetch("meta")
      expect(meta["page"]).to eq(2)
      expect(meta["per"]).to eq(2)
      expect(meta["total_count"]).to eq(5)
      expect(meta["total_pages"]).to eq(3)
    end

    it "clamps per to the max and normalizes invalid page" do
      get "/api/v1/items", params: { page: 0, per: 999 }, headers: headers

      meta = json_response.fetch("meta")
      expect(meta["page"]).to eq(1)
      expect(meta["per"]).to eq(100)
    end

    it "filters by tag_id" do
      tag = user.tags.create!(name: "英語")
      tagged = user.items.create!(title: "apple", item_type: item_type, generation_status: "completed")
      tagged.tags << tag
      user.items.create!(title: "他", item_type: item_type, generation_status: "completed")

      get "/api/v1/items", params: { tag_id: tag.id }, headers: headers

      expect(response).to have_http_status(:success)
      titles = json_response.fetch("items").map { |i| i["title"] }
      expect(titles).to eq([ "apple" ])
    end

    it "searches by title (case-insensitive, partial match)" do
      user.items.create!(title: "Photosynthesis", item_type: item_type, generation_status: "completed")
      user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      user.items.create!(title: "API", item_type: item_type, generation_status: "completed")

      get "/api/v1/items", params: { q: "photo" }, headers: headers

      expect(response).to have_http_status(:success)
      titles = json_response.fetch("items").map { |i| i["title"] }
      expect(titles).to eq([ "Photosynthesis" ])
    end

    it "escapes like wildcards in the query" do
      user.items.create!(title: "100%", item_type: item_type, generation_status: "completed")
      user.items.create!(title: "abc", item_type: item_type, generation_status: "completed")

      get "/api/v1/items", params: { q: "%" }, headers: headers

      titles = json_response.fetch("items").map { |i| i["title"] }
      expect(titles).to eq([ "100%" ])
    end
  end

  describe "GET /api/v1/items/suggest" do
    it "returns matching titles for autocomplete" do
      user.items.create!(title: "Photosynthesis", item_type: item_type, generation_status: "completed")
      user.items.create!(title: "API", item_type: item_type, generation_status: "completed")

      get "/api/v1/items/suggest", params: { q: "photo" }, headers: headers

      expect(response).to have_http_status(:success)
      suggestions = json_response.fetch("suggestions")
      expect(suggestions.map { |s| s["title"] }).to eq([ "Photosynthesis" ])
      expect(suggestions.first.keys).to contain_exactly("id", "title")
    end

    it "returns an empty list for a blank query" do
      user.items.create!(title: "apple", item_type: item_type, generation_status: "completed")

      get "/api/v1/items/suggest", params: { q: "" }, headers: headers

      expect(response).to have_http_status(:success)
      expect(json_response.fetch("suggestions")).to eq([])
    end

    it "does not return other users items" do
      other = create(:user, :confirmed)
      other.items.create!(title: "secret", item_type: item_type, generation_status: "completed")

      get "/api/v1/items/suggest", params: { q: "secret" }, headers: headers

      expect(json_response.fetch("suggestions")).to be_empty
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

    it "returns monthly usage counting only items created this month" do
      freeze_time do
        2.times { |n| user.items.create!(title: "今月-#{n}", item_type: item_type, generation_status: "completed") }
        user.items.create!(
          title: "先月分",
          item_type: item_type,
          generation_status: "completed",
          created_at: 1.month.ago,
          updated_at: 1.month.ago
        )

        get "/api/v1/items/summary", headers: headers, as: :json
      end

      expect(response).to have_http_status(:success)
      expect(json_response["monthly_count"]).to eq(2)
      expect(json_response["monthly_limit"]).to eq(Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH)
      expect(json_response["monthly_remaining"]).to eq(Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH - 2)
      expect(json_response["total_count"]).to eq(3)
      expect(json_response).to include("boxes_count", "views_count", "spaces_count")
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

  describe "PATCH /api/v1/items/:id" do
    it "updates the title and keeps media and generation status" do
      item = user.items.create!(title: "古いタイトル", item_type: item_type, generation_status: "completed")

      expect {
        patch "/api/v1/items/#{item.id}", params: { item: { title: "新しいタイトル" } }, headers: headers, as: :json
      }.not_to have_enqueued_job(GenerateImageJob)

      expect(response).to have_http_status(:success)
      expect(item.reload.title).to eq("新しいタイトル")
      expect(item.generation_status).to eq("completed")
      expect(json_response["title"]).to eq("新しいタイトル")
      expect(json_response["generation_status"]).to eq("completed")
    end

    it "sets tags from names (creating new tags and detaching removed ones)" do
      item = user.items.create!(title: "apple", item_type: item_type, generation_status: "completed")
      item.tags << user.tags.create!(name: "古い")

      patch "/api/v1/items/#{item.id}", params: { item: { tags: [ "英語", "果物" ] } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.tags.map(&:name)).to contain_exactly("英語", "果物")
      expect(json_response["tags"].map { |t| t["name"] }).to contain_exactly("英語", "果物")
      expect(user.tags.where(name: "英語")).to exist
    end

    it "deduplicates tag names case-insensitively" do
      item = user.items.create!(title: "apple", item_type: item_type, generation_status: "completed")

      patch "/api/v1/items/#{item.id}", params: { item: { tags: [ "Tag", "tag", " tag " ] } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.tags.count).to eq(1)
    end

    it "returns validation error when title is blank" do
      item = user.items.create!(title: "元タイトル", item_type: item_type, generation_status: "completed")

      patch "/api/v1/items/#{item.id}", params: { item: { title: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
      expect(item.reload.title).to eq("元タイトル")
    end

    it "rejects updating another users item" do
      other_user = create(:user, :confirmed)
      other_item = other_user.items.create!(title: "他人のカード", item_type: item_type, generation_status: "completed")

      patch "/api/v1/items/#{other_item.id}", params: { item: { title: "乗っ取り" } }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(json_response["error"]).to eq("Not found")
      expect(other_item.reload.title).to eq("他人のカード")
    end

    it "updates the item_type and serializes it" do
      concept = ItemType.find_or_create_by!(name: "concept") { |it| it.label = "概念" }
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")

      patch "/api/v1/items/#{item.id}", params: { item: { item_type_id: concept.id } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.item_type_id).to eq(concept.id)
      expect(json_response.dig("item_type", "name")).to eq("concept")
      expect(json_response.dig("item_type", "label")).to eq("概念")
    end

    it "creates a meaning when one is provided" do
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")

      patch "/api/v1/items/#{item.id}",
        params: { item: { meaning: "植物が光を使って養分を作る働き" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.meanings.in_language("ja").first&.definition).to eq("植物が光を使って養分を作る働き")
      expect(json_response["meaning"]).to eq("植物が光を使って養分を作る働き")
    end

    it "updates an existing meaning" do
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      item.meanings.create!(definition: "古い説明", language_code: "ja")

      patch "/api/v1/items/#{item.id}",
        params: { item: { meaning: "新しい説明" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.meanings.in_language("ja").count).to eq(1)
      expect(json_response["meaning"]).to eq("新しい説明")
    end

    it "説明を書き換えると以前のファクトチェック結果をクリアする" do
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      item.meanings.create!(definition: "古い説明", language_code: "ja",
        fact_check_status: "doubtful", fact_check_comment: "怪しい", fact_check_suggestion: "正しい説明")

      patch "/api/v1/items/#{item.id}",
        params: { item: { meaning: "新しい説明" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      meaning = item.reload.primary_meaning
      expect(meaning.definition).to eq("新しい説明")
      expect(meaning.fact_check_status).to be_nil
      expect(meaning.fact_check_suggestion).to be_nil
      expect(json_response["fact_check_status"]).to be_nil
    end

    it "単語名を変更すると以前のファクトチェック結果をクリアする" do
      item = user.items.create!(title: "トリトニウム", item_type: item_type, generation_status: "completed")
      item.meanings.create!(definition: "説明", language_code: "ja",
        fact_check_status: "doubtful", fact_check_comment: "別語の疑い",
        fact_check_title_suggestion: "トリチウム")

      patch "/api/v1/items/#{item.id}", params: { item: { title: "トリチウム" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.reload.title).to eq("トリチウム")
      meaning = item.primary_meaning
      expect(meaning.fact_check_status).to be_nil
      expect(meaning.fact_check_title_suggestion).to be_nil
      expect(json_response["fact_check_status"]).to be_nil
    end

    it "removes the meaning when an empty value is provided" do
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      item.meanings.create!(definition: "消される説明", language_code: "ja")

      patch "/api/v1/items/#{item.id}",
        params: { item: { meaning: "" } }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(item.meanings.in_language("ja").count).to eq(0)
      expect(json_response["meaning"]).to be_nil
    end
  end

  describe "POST /api/v1/items/:id/retry" do
    it "rejects items that are still generating" do
      item = user.items.create!(title: "富士山", item_type: item_type, generation_status: "processing")

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.not_to have_enqueued_job

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to eq("生成が完了または失敗したカードのみ再生成できます")
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
      }.to have_enqueued_job(GenerateImageJob).with(item.id, force_generate: false, use_meaning: false)

      expect(response).to have_http_status(:accepted)
      expect(item.reload.generation_status).to eq("pending")
      expect(item.generation_error).to be_nil
      expect(item.generation_error_code).to be_nil
      expect(json_response["generation_error"]).to be_nil
    end

    it "生成成功済み（completed）でもキャッシュを使わず再生成できる" do
      item = user.items.create!(title: "富士山", item_type: item_type, generation_status: "completed")

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.to have_enqueued_job(GenerateImageJob).with(item.id, force_generate: true, use_meaning: false)

      expect(response).to have_http_status(:accepted)
      expect(item.reload.generation_status).to eq("pending")
    end

    it "指示（custom_prompt / style）を渡すと item に反映して再生成する" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")

      expect {
        post "/api/v1/items/#{item.id}/retry",
          params: { item: { custom_prompt: "断面を見せて", style: "watercolor" } },
          headers: headers, as: :json
      }.to have_enqueued_job(GenerateImageJob).with(item.id, force_generate: true, use_meaning: false)

      expect(response).to have_http_status(:accepted)
      item.reload
      expect(item.custom_prompt).to eq("断面を見せて")
      expect(item.style).to eq("watercolor")
    end

    it "use_meaning を渡すと意味を参照して強制再生成する" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")
      item.meanings.create!(language_code: "ja", definition: "赤い果物", detail_level: "simple")

      expect {
        post "/api/v1/items/#{item.id}/retry",
          params: { item: { use_meaning: true } },
          headers: headers, as: :json
      }.to have_enqueued_job(GenerateImageJob).with(item.id, force_generate: true, use_meaning: true)

      expect(response).to have_http_status(:accepted)
    end

    it "指示が不適切な場合は 422 を返し、再生成しない" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")

      expect {
        post "/api/v1/items/#{item.id}/retry",
          params: { item: { custom_prompt: "in a rape scene" } },
          headers: headers, as: :json
      }.not_to have_enqueued_job(GenerateImageJob)

      expect(response).to have_http_status(:unprocessable_content)
      expect(item.reload.generation_status).to eq("completed")
    end
  end

  describe "POST /api/v1/items/:id/tags" do
    it "AI生成タグを既存タグへ union 付与して返す" do
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      item.tags << user.tags.create!(name: "お気に入り")
      allow(GenerateTagsService).to receive(:call) do |item:, replace: false|
        item.tags = (item.tags + [ item.user.tags.find_or_create_by!(name: "生物学") ]).uniq
        item
      end

      post "/api/v1/items/#{item.id}/tags", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response["tags"].map { |t| t["name"] }).to match_array(%w[お気に入り 生物学])
    end

    it "他人のカードには 404" do
      other = create(:user, :confirmed)
      item = other.items.create!(title: "他人", item_type: item_type, generation_status: "completed")

      post "/api/v1/items/#{item.id}/tags", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "生成に失敗したら 422" do
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      allow(GenerateTagsService).to receive(:call).and_raise(GenerateTagsService::GenerationError, "失敗")

      post "/api/v1/items/#{item.id}/tags", headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to be_present
    end

    it "認証なしでは 401" do
      item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")

      post "/api/v1/items/#{item.id}/tags", as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/items/:id の生成情報（media.generation_info）" do
    it "ホワイトリストしたキーだけを generation_info で返す" do
      item = create(:item, :completed, user: user)
      create(:media, :with_file, item: item, metadata: {
        "provider" => "openai",
        "model" => "gpt-image-1",
        "quality" => "medium",
        "size" => "1024x1024",
        "revised_prompt" => "a red apple on a table",
        "internal_secret" => "should-not-leak"
      })

      get "/api/v1/items/#{item.id}", headers: headers

      expect(response).to have_http_status(:ok)
      info = json_response.dig("media", "generation_info")
      expect(info["model"]).to eq("gpt-image-1")
      expect(info["provider"]).to eq("openai")
      expect(info["revised_prompt"]).to eq("a red apple on a table")
      expect(info).not_to have_key("internal_secret")
    end

    it "メタ情報が無い場合は generation_info が nil" do
      item = create(:item, :completed, user: user)
      create(:media, :with_file, item: item, metadata: {})

      get "/api/v1/items/#{item.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response.dig("media", "generation_info")).to be_nil
    end
  end

  describe "GET /api/v1/items/:id のサムネ・LQIP（media.thumb_url / media.blur）" do
    around do |example|
      # CDN_BASE_URL を設定すると media_url が公開 URL（末尾が blob.key）を返すため、
      # どの blob が使われているかを URL から検証できる。
      original = ENV["CDN_BASE_URL"]
      ENV["CDN_BASE_URL"] = "https://cdn.test.example"
      example.run
      ENV["CDN_BASE_URL"] = original
    end

    it "事前生成済みサムネがある場合、thumb_url はフル画像ではなく thumb blob を指す" do
      item = create(:item, :completed, user: user)
      media = create(:media, :with_thumb, item: item)

      get "/api/v1/items/#{item.id}", headers: headers

      expect(response).to have_http_status(:ok)
      url = json_response.dig("media", "url")
      thumb_url = json_response.dig("media", "thumb_url")
      expect(url).to end_with(media.file.blob.key)
      expect(thumb_url).to end_with(media.thumb.blob.key)
      expect(thumb_url).not_to eq(url)
    end

    it "LQIP（lqip メタ）があれば blur に data URL を返す" do
      item = create(:item, :completed, user: user)
      create(:media, :with_thumb, item: item, metadata: { "lqip" => "data:image/webp;base64,AAAA" })

      get "/api/v1/items/#{item.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response.dig("media", "blur")).to eq("data:image/webp;base64,AAAA")
    end
  end

  describe "DELETE /api/v1/items/bulk_destroy" do
    it "指定した自分のカードを一括削除し deleted_ids を返す" do
      a = create(:item, user: user)
      b = create(:item, user: user)
      keep = create(:item, user: user)

      expect {
        delete "/api/v1/items/bulk_destroy", params: { ids: [ a.id, b.id ] }, headers: headers, as: :json
      }.to change { user.items.count }.by(-2)

      expect(response).to have_http_status(:ok)
      expect(json_response["deleted_ids"]).to match_array([ a.id, b.id ])
      expect(Item.exists?(keep.id)).to be true
    end

    it "他人のカード ID は無視する" do
      other = create(:user, :confirmed)
      mine = create(:item, user: user)
      theirs = create(:item, user: other)

      delete "/api/v1/items/bulk_destroy", params: { ids: [ mine.id, theirs.id ] }, headers: headers, as: :json

      expect(json_response["deleted_ids"]).to eq([ mine.id ])
      expect(Item.exists?(theirs.id)).to be true
    end

    it "ids が空なら何も削除しない" do
      create(:item, user: user)

      expect {
        delete "/api/v1/items/bulk_destroy", params: { ids: [] }, headers: headers, as: :json
      }.not_to(change { Item.count })

      expect(json_response["deleted_ids"]).to eq([])
    end

    it "認証なしでは 401" do
      delete "/api/v1/items/bulk_destroy", params: { ids: [] }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "AI一括操作系エンドポイント" do
    describe "POST /api/v1/items/:id/fact_check" do
      it "説明があればファクトチェック結果を返す" do
        item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
        item.meanings.create!(definition: "説明文です", language_code: "ja")
        allow(GenerateFactCheckService).to receive(:call) do
          m = item.primary_meaning
          m.update!(fact_check_status: "doubtful", fact_check_comment: "一部不正確です", fact_checked_at: Time.current)
          m
        end

        post "/api/v1/items/#{item.id}/fact_check", headers: headers, as: :json

        expect(response).to have_http_status(:ok)
        expect(json_response["fact_check_status"]).to eq("doubtful")
        expect(json_response["fact_check_comment"]).to eq("一部不正確です")
      end

      it "説明が無ければスキップを返す" do
        item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")

        post "/api/v1/items/#{item.id}/fact_check", headers: headers, as: :json

        expect(response).to have_http_status(:ok)
        expect(json_response["status"]).to eq("skipped")
        expect(json_response["reason"]).to eq("no_meaning")
      end
    end

    describe "POST /api/v1/items/:id/tags" do
      it "replace=true で既存タグを置き換える" do
        item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
        item.tags << user.tags.create!(name: "古い")
        allow(GenerateTagsService).to receive(:call).with(item: instance_of(Item), replace: true) do
          item.tags = [ user.tags.find_or_create_by!(name: "新しい") ]
          item
        end

        post "/api/v1/items/#{item.id}/tags", params: { replace: true }, headers: headers, as: :json

        expect(response).to have_http_status(:ok)
        expect(item.reload.tags.map(&:name)).to eq(%w[新しい])
      end

      it "only_if_empty=true でタグ有りはスキップ" do
        item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
        item.tags << user.tags.create!(name: "既存")

        expect(GenerateTagsService).not_to receive(:call)
        post "/api/v1/items/#{item.id}/tags", params: { only_if_empty: true }, headers: headers, as: :json

        expect(json_response["status"]).to eq("skipped")
        expect(json_response["reason"]).to eq("already_tagged")
      end
    end

    describe "POST /api/v1/items/:id/meaning" do
      it "only_if_empty=true で説明有りはスキップ" do
        item = user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
        item.meanings.create!(definition: "既存の説明", language_code: "ja")

        expect(GenerateMeaningService).not_to receive(:call)
        post "/api/v1/items/#{item.id}/meaning", params: { only_if_empty: true }, headers: headers, as: :json

        expect(json_response["status"]).to eq("skipped")
        expect(json_response["reason"]).to eq("already_has_meaning")
      end
    end
  end
end
