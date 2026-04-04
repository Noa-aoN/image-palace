require "test_helper"

class Items::CreateServiceTest < ActiveSupport::TestCase
  setup do
    @user = create_confirmed_user
    @item_type = default_item_type
  end

  test "creates a pending item with default item type and enqueues image generation" do
    result = nil

    assert_difference("@user.items.count", 1) do
      assert_enqueued_with(job: GenerateImageJob) do
        result = Items::CreateService.call(user: @user, params: { title: "富士山" })
      end
    end

    item = result.item
    assert_equal "富士山", item.title
    assert_equal "pending", item.generation_status
    assert_equal @item_type.id, item.item_type_id
    assert_nil item.generation_error
  end

  test "passes through force_generate to the enqueued job" do
    Items::CreateService.call(user: @user, params: { title: "富士山", force_generate: true })

    assert_equal true, enqueued_jobs.last[:args][1].with_indifferent_access[:force_generate]
  end

  test "raises monthly limit exceeded when the user already created 100 items this month" do
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

      assert_raises(Items::CreateService::MonthlyLimitExceeded) do
        Items::CreateService.call(user: @user, params: { title: "101枚目" })
      end
    end
  end
end
