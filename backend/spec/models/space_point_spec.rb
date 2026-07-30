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

    it "defaults surface to floor" do
      expect(create(:space_point).surface).to eq("floor")
    end

    it "rejects an unknown surface" do
      expect(build(:space_point, surface: "wall_up")).not_to be_valid
    end

    it "accepts the 6 room surfaces" do
      SpacePoint::SURFACES.each do |surface|
        expect(build(:space_point, surface: surface)).to be_valid
      end
    end
  end

  describe "面内座標 (u,v) のクランプ" do
    it "0..1 の範囲外を 0..1 に丸める" do
      point = create(:space_point, u: 1.5, v: -0.3)

      expect(point.u).to eq(1.0)
      expect(point.v).to eq(0.0)
    end

    it "範囲内はそのまま保持する" do
      point = create(:space_point, u: 0.25, v: 0.75)

      expect(point.u).to eq(0.25)
      expect(point.v).to eq(0.75)
    end

    it "表示倍率 scale を 0.3..3.0 にクランプする" do
      expect(create(:space_point, scale: 5.0).scale).to eq(3.0)
      expect(create(:space_point, scale: 0.1).scale).to eq(0.3)
      expect(create(:space_point, scale: 1.5).scale).to eq(1.5)
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
