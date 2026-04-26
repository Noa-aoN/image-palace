require "rails_helper"

RSpec.describe Item, type: :model do
  describe "validations" do
    it "requires title" do
      item = build(:item, title: nil)
      expect(item).to be_invalid
      expect(item.errors[:title]).to include("can't be blank")
    end

    it "rejects an unknown generation_status" do
      item = build(:item, generation_status: "unknown")
      expect(item).to be_invalid
      expect(item.errors[:generation_status]).to be_present
    end

    Item::GENERATION_STATUSES.each do |status|
      it "accepts generation_status \"#{status}\"" do
        item = build(:item, generation_status: status)
        expect(item).to be_valid
      end
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:item_type) }
    it { is_expected.to have_many(:meanings).dependent(:destroy) }
    it { is_expected.to have_many(:medias).dependent(:destroy) }
  end

  describe "#primary_media" do
    it "returns the media with the smallest position" do
      item = create(:item)
      first_media  = create(:media, item: item, position: 0)
      _second_media = create(:media, item: item, position: 1)

      expect(item.primary_media).to eq(first_media)
    end

    it "treats nil position as last" do
      item = create(:item)
      positioned = create(:media, item: item, position: 5)
      _unpositioned = create(:media, item: item, position: nil)

      expect(item.primary_media).to eq(positioned)
    end
  end

  describe "#mark_generation_failed!" do
    it "sets failed status with error message and code" do
      item = create(:item, :processing)

      item.mark_generation_failed!(message: "テスト失敗", code: "TestError")

      expect(item.reload.generation_status).to eq("failed")
      expect(item.generation_error).to eq("テスト失敗")
      expect(item.generation_error_code).to eq("TestError")
    end

    it "preserves unrelated metadata keys" do
      item = create(:item, :processing, metadata: { "other_key" => "value" })

      item.mark_generation_failed!(message: "失敗", code: "X")

      expect(item.reload.metadata).to include("other_key" => "value", "generation_error" => "失敗", "generation_error_code" => "X")
    end
  end

  describe "#update_generation_status!" do
    it "clears generation_error when transitioning away from failed" do
      item = create(:item, :failed)
      expect(item.generation_error).to be_present

      item.update_generation_status!("completed")

      expect(item.reload.generation_status).to eq("completed")
      expect(item.generation_error).to be_nil
      expect(item.generation_error_code).to be_nil
    end
  end
end
