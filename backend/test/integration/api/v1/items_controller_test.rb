require "test_helper"

class Api::V1::ItemsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = create_confirmed_user
    @headers = auth_headers_for(@user)
    @item_type = default_item_type
  end

  test "create enqueues image generation and returns pending item" do
    assert_difference("@user.items.count", 1) do
      assert_enqueued_with(job: GenerateImageJob) do
        post "/api/v1/items",
             params: { item: { title: "富士山" } },
             headers: @headers,
             as: :json
      end
    end

    assert_response :accepted
    created_item = @user.items.order(created_at: :desc).first
    assert_equal "富士山", created_item.title
    assert_equal "pending", created_item.generation_status
    assert_nil created_item.generation_error
    assert_equal created_item.id, json_response["id"]
    assert_equal "pending", json_response["generation_status"]
    assert_nil json_response["generation_error"]
  end

  test "create returns validation error when monthly limit is exceeded" do
    freeze_time do
      Items::CreateService::FREE_ITEM_LIMIT_PER_MONTH.times do |index|
        @user.items.create!(
          title: "card-#{index}",
          item_type: @item_type,
          generation_status: "completed",
          created_at: Time.current,
          updated_at: Time.current
        )
      end

      assert_no_enqueued_jobs do
        post "/api/v1/items",
             params: { item: { title: "101枚目" } },
             headers: @headers,
             as: :json
      end
    end

    assert_response :unprocessable_entity
    assert_equal "今月の生成枚数の上限（100枚）に達しました", json_response["error"]
  end

  test "index returns items ordered by created_at desc with generation fields" do
    older_item = @user.items.create!(
      title: "古いカード",
      item_type: @item_type,
      generation_status: "pending",
      created_at: 2.days.ago,
      updated_at: 2.days.ago
    )
    newer_item = @user.items.create!(
      title: "新しいカード",
      item_type: @item_type,
      generation_status: "failed",
      metadata: {
        "generation_error" => "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。",
        "generation_error_code" => "Faraday::BadRequestError"
      },
      created_at: 1.day.ago,
      updated_at: 1.day.ago
    )

    get "/api/v1/items", headers: @headers, as: :json

    assert_response :success
    items = json_response["items"]
    assert_equal [newer_item.id, older_item.id], items.map { |item| item["id"] }
    assert_equal "failed", items.first["generation_status"]
    assert_equal "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。", items.first["generation_error"]
    assert_nil items.last["generation_error"]
  end

  test "summary returns counts grouped by generation status" do
    @user.items.create!(title: "pending", item_type: @item_type, generation_status: "pending")
    @user.items.create!(title: "processing", item_type: @item_type, generation_status: "processing")
    @user.items.create!(title: "failed", item_type: @item_type, generation_status: "failed")
    @user.items.create!(title: "completed", item_type: @item_type, generation_status: "completed")

    get "/api/v1/items/summary", headers: @headers, as: :json

    assert_response :success
    assert_equal 4, json_response["total_count"]
    assert_equal 1, json_response["pending_count"]
    assert_equal 1, json_response["processing_count"]
    assert_equal 1, json_response["failed_count"]
  end

  test "show returns generation_error for failed items" do
    item = @user.items.create!(
      title: "aaaaaaa",
      item_type: @item_type,
      generation_status: "failed",
      metadata: {
        "generation_error" => "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。",
        "generation_error_code" => "Faraday::BadRequestError"
      }
    )

    get "/api/v1/items/#{item.id}", headers: @headers, as: :json

    assert_response :success
    assert_equal "failed", json_response["generation_status"]
    assert_equal "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。", json_response["generation_error"]
  end

  test "retry rejects items that are not failed" do
    item = @user.items.create!(
      title: "富士山",
      item_type: @item_type,
      generation_status: "completed"
    )

    assert_no_enqueued_jobs do
      post "/api/v1/items/#{item.id}/retry", headers: @headers, as: :json
    end

    assert_response :unprocessable_entity
    assert_equal "failed 状態のカードのみ再生成できます", json_response["error"]
  end

  test "retry clears generation_error and enqueues image generation" do
    item = @user.items.create!(
      title: "aaaaaaa",
      item_type: @item_type,
      generation_status: "failed",
      metadata: {
        "generation_error" => "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。",
        "generation_error_code" => "Faraday::BadRequestError"
      }
    )

    assert_enqueued_with(job: GenerateImageJob) do
      post "/api/v1/items/#{item.id}/retry", headers: @headers, as: :json
    end

    assert_response :accepted
    assert_equal "pending", item.reload.generation_status
    assert_nil item.generation_error
    assert_nil item.generation_error_code
    assert_nil json_response["generation_error"]
    assert_equal item.id, enqueued_jobs.last[:args][0]
  end
end
