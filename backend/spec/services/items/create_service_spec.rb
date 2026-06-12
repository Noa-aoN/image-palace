require "rails_helper"

RSpec.describe Items::CreateService, type: :service do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  describe ".call" do
    it "creates a pending item with default item type and enqueues image generation" do
      result = nil

      expect {
        expect {
          result = described_class.call(user: user, params: { title: "富士山" })
        }.to have_enqueued_job(GenerateImageJob)
      }.to change { user.items.count }.by(1)

      item = result.item
      expect(item.title).to eq("富士山")
      expect(item.generation_status).to eq("pending")
      expect(item.item_type_id).to eq(item_type.id)
      expect(item.generation_error).to be_nil
    end

    it "passes through force_generate to the enqueued job" do
      described_class.call(user: user, params: { title: "富士山", force_generate: true })

      expect(enqueued_jobs.last[:args][1].with_indifferent_access[:force_generate]).to be true
    end

    it "スタイルとカスタムプロンプトを保存する" do
      result = described_class.call(user: user, params: { title: "cat", style: "watercolor", custom_prompt: "wearing a hat" })

      expect(result.item.style).to eq("watercolor")
      expect(result.item.custom_prompt).to eq("wearing a hat")
    end

    it "raises monthly limit exceeded when the user already created 100 items this month" do
      freeze_time do
        described_class::FREE_ITEM_LIMIT_PER_MONTH.times do |index|
          user.items.create!(
            title: "card-#{index}",
            item_type: item_type,
            generation_status: "completed",
            created_at: Time.current,
            updated_at: Time.current
          )
        end

        expect {
          described_class.call(user: user, params: { title: "101枚目" })
        }.to raise_error(described_class::MonthlyLimitExceeded)
      end
    end
  end
end
