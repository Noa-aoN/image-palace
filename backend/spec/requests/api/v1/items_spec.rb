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
      # 画像の前に下ごしらえ（説明文・情景プロンプト）を挟み、そこから画像生成へ引き継ぐ
      expect {
        expect {
          post "/api/v1/items", params: { item: { title: "富士山" } }, headers: headers, as: :json
        }.to have_enqueued_job(GenerateBriefJob)
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
      }.not_to have_enqueued_job

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["errors"]).to be_present
    end

    it "returns an error and enqueues nothing when the user is out of credits" do
      # 無料枠を付与してから 0 にし、残高切れを再現する
      user.ensure_current_period_credits!
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.credit_grants.destroy_all
      user.mark_trial_granted!

      expect {
        post "/api/v1/items", params: { item: { title: "no-credit" } }, headers: headers, as: :json
      }.not_to have_enqueued_job

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to eq("クレジットが不足しています")
    end

    it "不適切なプロンプトは 422 を返し、アイテムを作らずジョブも積まない" do
      expect {
        post "/api/v1/items", params: { item: { title: "a cute loli" } }, headers: headers, as: :json
      }.not_to have_enqueued_job

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

  describe "GET /api/v1/items/navigation" do
    it "returns all own item ids ordered like the default item list" do
      created = 30.times.map do |i|
        user.items.create!(
          title: "カード#{i}",
          item_type: item_type,
          generation_status: "completed",
          created_at: i.minutes.ago
        )
      end
      other = create(:user, :confirmed)
      other.items.create!(title: "他人", item_type: item_type, generation_status: "completed")

      get "/api/v1/items/navigation", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response.fetch("ids")).to eq(created.map(&:id))
      expect(json_response.fetch("ids").size).to eq(30)
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

    it "returns container counts" do
      user.items.create!(title: "あ", item_type: item_type, generation_status: "completed")

      get "/api/v1/items/summary", headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["total_count"]).to eq(1)
      expect(json_response).to include("boxes_count", "views_count", "spaces_count")
    end

    # 「あと何枚つくれるか」はクレジット残高が持つ。ここが返していた固定上限は
    # クレジット制へ移る前の名残で、実態と合わない数字だった
    it "月間の固定上限は返さない（クレジット残高が上限を決めるため）" do
      get "/api/v1/items/summary", headers: headers, as: :json

      expect(json_response).not_to include("monthly_limit", "monthly_remaining")
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
          "generation_error" => "通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。",
          "generation_error_code" => "Faraday::TimeoutError",
          "generation_failure_kind" => "temporary"
        }
      )

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.to have_enqueued_job(GenerateBriefJob).with(item.id, force_generate: false, use_meaning: false)

      expect(response).to have_http_status(:accepted)
      expect(item.reload.generation_status).to eq("pending")
      expect(item.generation_error).to be_nil
      expect(item.generation_error_code).to be_nil
      expect(json_response["generation_error"]).to be_nil
    end

    # 前に何を注文したかは指紋で残る。同じ注文かどうかはこれで見る
    def mark_ordered!(item)
      item.update!(metadata: item.metadata.merge(
        "prompt_fingerprint" => Images::PromptFingerprint.call(item).digest
      ))
    end

    it "入力に因る失敗は、入力を変えないと作り直せない" do
      item = user.items.create!(
        title: "aaaaaaa", item_type: item_type, generation_status: "failed",
        metadata: { "generation_error" => "入力が曖昧なため画像を生成できませんでした。",
                    "generation_error_code" => "Faraday::BadRequestError",
                    "generation_failure_kind" => "invalid_input" }
      )
      mark_ordered!(item)

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.not_to have_enqueued_job

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response["error"]).to include("単語をより具体的に")
      expect(item.reload.generation_status).to eq("failed")
    end

    it "入力に因る失敗でも、指示を添えれば作り直せる" do
      item = user.items.create!(
        title: "aaaaaaa", item_type: item_type, generation_status: "failed",
        metadata: { "generation_error_code" => "Faraday::BadRequestError",
                    "generation_failure_kind" => "content_policy" }
      )
      mark_ordered!(item)

      expect {
        post "/api/v1/items/#{item.id}/retry",
          params: { item: { custom_prompt: "図解として描いて" } }, headers: headers, as: :json
      }.to have_enqueued_job(GenerateBriefJob)

      expect(response).to have_http_status(:accepted)
    end

    it "この仕組みより前に失敗した（指紋の無い）カードは、判断がつかないので通す" do
      item = user.items.create!(
        title: "aaaaaaa", item_type: item_type, generation_status: "failed",
        metadata: { "generation_error_code" => "Faraday::BadRequestError",
                    "generation_failure_kind" => "invalid_input" }
      )

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.to have_enqueued_job(GenerateBriefJob)

      expect(response).to have_http_status(:accepted)
    end

    it "無料の作り直しを使い切ると、以降はクレジットを使う" do
      item = user.items.create!(
        title: "富士山", item_type: item_type, generation_status: "failed",
        metadata: { "generation_failure_kind" => "temporary",
                    "free_retries" => Images::RetryPolicy::FREE_RETRY_LIMIT }
      )
      mark_ordered!(item)
      user.update!(subscription_credits: 10_000)

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.to change { user.reload.available_credit_points }

      expect(response).to have_http_status(:accepted)
      # 取ったあとは数え直す（次の失敗からまた無料の回数が使える）
      expect(item.reload.metadata["free_retries"]).to eq(0)
    end

    it "無料の回数の内なら、クレジットは減らない" do
      item = user.items.create!(
        title: "富士山", item_type: item_type, generation_status: "failed",
        metadata: { "generation_failure_kind" => "temporary" }
      )
      mark_ordered!(item)
      user.update!(subscription_credits: 10_000)

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.not_to(change { user.reload.available_credit_points })

      expect(item.reload.metadata["free_retries"]).to eq(1)
    end

    it "生成成功済み（completed）でもキャッシュを使わず再生成できる" do
      item = user.items.create!(title: "富士山", item_type: item_type, generation_status: "completed")

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.to have_enqueued_job(GenerateBriefJob).with(item.id, force_generate: true, use_meaning: false)

      expect(response).to have_http_status(:accepted)
      expect(item.reload.generation_status).to eq("pending")
    end

    it "情景プロンプトが既にあるカードは、下ごしらえを挟まず画像生成へ進む" do
      item = user.items.create!(
        title: "富士山", item_type: item_type, generation_status: "completed",
        scene_prompt: "a snow-capped mountain", brief_status: "completed"
      )

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.to have_enqueued_job(GenerateImageJob).with(item.id, force_generate: true, use_meaning: false)
    end

    it "指示（custom_prompt / style）を渡すと item に反映して再生成する" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")

      expect {
        post "/api/v1/items/#{item.id}/retry",
          params: { item: { custom_prompt: "断面を見せて", style: "watercolor" } },
          headers: headers, as: :json
      }.to have_enqueued_job(GenerateBriefJob).with(item.id, force_generate: true, use_meaning: false)

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
      }.to have_enqueued_job(GenerateBriefJob).with(item.id, force_generate: true, use_meaning: true)

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

  describe "画像の下ごしらえ（説明文・情景プロンプト）" do
    let(:brief) do
      SharedBrief.create!(
        normalized_source: "機会費用\nv1",
        description: "ある選択で諦めた他の選択肢の価値。",
        subject_kind: "abstract",
        scene_prompt: "a person standing at a fork in a country road"
      )
    end

    it "作成時は画像より先に下ごしらえのジョブを積む" do
      expect {
        post "/api/v1/items", params: { item: { title: "機会費用" } }, headers: headers, as: :json
      }.to have_enqueued_job(GenerateBriefJob)

      expect(response).to have_http_status(:accepted)
      expect(json_response["brief_status"]).to eq("pending")
    end

    it "詳細に説明文と情景プロンプトを含める" do
      item = user.items.create!(
        title: "機会費用", item_type: item_type, generation_status: "completed",
        image_description: "説明", scene_prompt: "a fork in the road", brief_status: "completed"
      )

      get "/api/v1/items/#{item.id}", headers: headers

      expect(json_response["image_description"]).to eq("説明")
      expect(json_response["scene_prompt"]).to eq("a fork in the road")
      expect(json_response["brief_status"]).to eq("completed")
      expect(json_response["brief_edited"]).to be(false)
    end

    describe "PATCH で編集する" do
      let(:item) do
        user.items.create!(
          title: "機会費用", item_type: item_type, generation_status: "completed",
          image_description: "自動の説明", scene_prompt: "auto scene", brief_status: "completed"
        )
      end

      it "手直しすると編集済みとして記録し、以後の自動生成で上書きしない" do
        patch "/api/v1/items/#{item.id}",
              params: { item: { scene_prompt: "my own scene" } }, headers: headers, as: :json

        expect(response).to have_http_status(:success)
        expect(item.reload.scene_prompt).to eq("my own scene")
        expect(item.brief_edited?).to be(true)
        expect(json_response["brief_edited"]).to be(true)
      end

      it "情景を空にすると「無し」に戻る（単語をそのまま使う）" do
        patch "/api/v1/items/#{item.id}",
              params: { item: { scene_prompt: "" } }, headers: headers, as: :json

        expect(item.reload.brief_status).to eq("none")
        expect(PromptBuilderService.subject(item)).to eq("機会費用")
      end

      it "編集しても画像は作り直さない（明示的な再生成のときだけ）" do
        expect {
          patch "/api/v1/items/#{item.id}",
                params: { item: { scene_prompt: "my own scene" } }, headers: headers, as: :json
        }.not_to have_enqueued_job(GenerateImageJob)
      end

      it "情景プロンプトも作成時と同じ基準で検査する" do
        allow(Moderation::PromptModerator).to receive(:call)
          .and_return(Moderation::PromptModerator::Result.new(allowed: false, category: "test", term: "ng"))

        patch "/api/v1/items/#{item.id}",
              params: { item: { scene_prompt: "something blocked" } }, headers: headers, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(item.reload.scene_prompt).to eq("auto scene")
      end
    end

    describe "POST /api/v1/items/:id/brief" do
      it "作り直して保存する" do
        item = user.items.create!(title: "機会費用", item_type: item_type, generation_status: "completed")
        allow(Images::BriefResolver).to receive(:call).and_return(brief)

        post "/api/v1/items/#{item.id}/brief", headers: headers, as: :json

        expect(response).to have_http_status(:success)
        expect(item.reload.scene_prompt).to eq("a person standing at a fork in a country road")
        expect(json_response["brief_status"]).to eq("completed")
      end

      it "手直し済みでも、明示的に押されたら作り直して編集済みを解除する" do
        item = user.items.create!(
          title: "機会費用", item_type: item_type, generation_status: "completed",
          scene_prompt: "my own scene", brief_edited_at: Time.current
        )
        allow(Images::BriefResolver).to receive(:call).and_return(brief)

        post "/api/v1/items/#{item.id}/brief", headers: headers, as: :json

        expect(item.reload.brief_edited?).to be(false)
        expect(item.scene_prompt).not_to eq("my own scene")
      end

      it "他人のカードは作り直せない" do
        other = create(:user, :confirmed)
        item = other.items.create!(title: "他人", item_type: item_type, generation_status: "completed")

        post "/api/v1/items/#{item.id}/brief", headers: headers, as: :json

        expect(response).to have_http_status(:not_found)
      end

      it "未ログインでは作り直せない" do
        item = user.items.create!(title: "機会費用", item_type: item_type, generation_status: "completed")

        post "/api/v1/items/#{item.id}/brief", as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "作り直しのクレジット" do
    let(:cost) { ::Billing::CreditCost.call(kind: :regeneration) }

    # 「使い切った」状態を作る。先に付与を済ませてから空にしないと、
    # 消費時の付与（お試し・毎月分）でまた入ってしまう
    def empty_balance!
      user.ensure_free_credits!
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.credit_grants.destroy_all
    end

    it "出来上がったものを作り直すとクレジットを使う" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")
      user.ensure_free_credits!
      before = user.reload.available_credit_points

      post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json

      expect(response).to have_http_status(:accepted)
      expect(user.reload.available_credit_points).to eq(before - cost)
    end

    it "失敗からの作り直しは無料（渡せていないものに課金しない）" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "failed")
      user.ensure_free_credits!

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.not_to(change { user.reload.available_credit_points })

      expect(response).to have_http_status(:accepted)
    end

    it "指示を付けて失敗から作り直しても無料" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "failed")
      user.ensure_free_credits!

      expect {
        post "/api/v1/items/#{item.id}/retry",
             params: { item: { custom_prompt: "断面を見せて" } }, headers: headers, as: :json
      }.not_to(change { user.reload.available_credit_points })
    end

    it "残高が足りなければ作り直せない（生成も積まない）" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")
      empty_balance!

      expect {
        post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      }.not_to have_enqueued_job

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response["error"]).to eq("クレジットが不足しています")
      expect(item.reload.generation_status).to eq("completed")
    end

    it "作り直しは台帳に残る（何に使ったか追える）" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")
      user.ensure_free_credits!

      post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json

      entry = user.credit_transactions.where(kind: "consumption").order(:created_at).last
      expect(entry.item_id).to eq(item.id)
      expect(entry.delta).to eq(-cost)
    end

    it "何度も作り直すと、そのぶん減る（無料で引き放題にしない）" do
      item = user.items.create!(title: "りんご", item_type: item_type, generation_status: "completed")
      user.ensure_free_credits!
      before = user.reload.available_credit_points

      post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      expect(response).to have_http_status(:accepted)
      item.reload.update!(generation_status: "completed")

      post "/api/v1/items/#{item.id}/retry", headers: headers, as: :json
      expect(response).to have_http_status(:accepted)

      expect(user.reload.available_credit_points).to eq(before - cost * 2)
      expect(user.credit_transactions.where(kind: "consumption").count).to eq(2)
    end
  end
end

# 一覧の札に**属性の印**（種別の一文字）を出すために、種別を返す。
# 問い合わせは増えない（一覧も検索も `includes(:item_type)` 済み）。
RSpec.describe "カード一覧が種別を返す", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "person") { |t| t.label = "人物" } }

  it "一覧に種別が入る" do
    create(:item, user: user, item_type: item_type, title: "アポロン")

    get "/api/v1/items", headers: headers

    row = json_response["items"].first
    expect(row["item_type"]).to include("name" => "person", "label" => "人物")
  end

  # **枚数を増やしても問い合わせが増えないこと。**
  # ここが崩れると、一覧が重くなるのに画面では気づけない
  it "枚数を増やしても、種別のぶんの問い合わせが増えない" do
    3.times { |i| create(:item, user: user, item_type: item_type, title: "カード#{i}") }
    get "/api/v1/items", headers: headers # ウォームアップ（初回だけ走る問い合わせを除く）

    few = count_queries { get "/api/v1/items", headers: headers }
    5.times { |i| create(:item, user: user, item_type: item_type, title: "追加#{i}") }
    many = count_queries { get "/api/v1/items", headers: headers }

    expect(many).to eq(few)
  end

  def count_queries
    count = 0
    counter = ->(_n, _s, _f, _i, payload) { count += 1 unless payload[:name].to_s.in?([ "SCHEMA", "TRANSACTION" ]) }
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { yield }
    count
  end
end
