require "rails_helper"

RSpec.describe SpacePoint, type: :model do
  describe "validations" do
    it "requires an integer position" do
      expect(build(:space_point, position: nil)).not_to be_valid
    end

    it "limits name length" do
      expect(build(:space_point, name: "a" * (SpacePoint::NAME_MAX_LENGTH + 1))).not_to be_valid
    end

    it "allows a blank name (空ポイント)" do
      expect(build(:space_point, name: nil)).to be_valid
    end

    it "rejects an unknown generation_status" do
      expect(build(:space_point, generation_status: "bogus")).not_to be_valid
    end
  end

  describe "scopes" do
    it ".named returns only points with a non-blank name" do
      named = create(:space_point, name: "玄関")
      create(:space_point, name: nil)
      create(:space_point, name: "")

      expect(SpacePoint.named).to contain_exactly(named)
    end
  end

  describe "#mark_generation_failed!" do
    it "stores the error and sets failed status" do
      point = create(:space_point, name: "玄関", generation_status: "processing")

      point.mark_generation_failed!(message: "失敗しました", code: "SomeError")

      expect(point.generation_status).to eq("failed")
      expect(point.generation_error).to eq("失敗しました")
      expect(point.generation_error_code).to eq("SomeError")
    end
  end

  describe "#update_generation_status!" do
    it "clears prior error metadata" do
      point = create(:space_point, name: "玄関")
      point.mark_generation_failed!(message: "失敗")

      point.update_generation_status!("completed")

      expect(point.generation_status).to eq("completed")
      expect(point.generation_error).to be_nil
    end
  end
end
