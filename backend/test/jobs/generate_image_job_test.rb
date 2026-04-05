require "test_helper"

class GenerateImageJobTest < ActiveJob::TestCase
  setup do
    @user = create_confirmed_user
    @item_type = default_item_type
    @item = @user.items.create!(
      title: "aaaaaaa",
      item_type: @item_type,
      generation_status: "processing"
    )
  end

  test "stores a user friendly error for invalid prompts" do
    error = Faraday::BadRequestError.new("400 Bad Request")

    GenerateImageJob.new.send(:mark_failed!, @item.id, error)

    @item.reload
    assert_equal "failed", @item.generation_status
    assert_equal "Faraday::BadRequestError", @item.generation_error_code
    assert_equal "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。", @item.generation_error
  end

  test "stores a retry hint for network failures" do
    error = Faraday::SSLError.new("SSL_read: unexpected eof while reading")

    GenerateImageJob.new.send(:mark_failed!, @item.id, error)

    @item.reload
    assert_equal "failed", @item.generation_status
    assert_equal "Faraday::SSLError", @item.generation_error_code
    assert_equal "通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。", @item.generation_error
  end

  test "perform clears stale generation_error when cached media completes the item" do
    create_shared_media_for(prompt: @item.title, user: @user, metadata: { "provider" => "openai" })
    @item.mark_generation_failed!(message: "古い失敗理由", code: "old_error")

    GenerateImageJob.perform_now(@item.id)

    @item.reload
    assert_equal "completed", @item.generation_status
    assert_nil @item.generation_error
    assert_nil @item.generation_error_code
    assert_predicate @item.primary_media.file, :attached?
  end
end
