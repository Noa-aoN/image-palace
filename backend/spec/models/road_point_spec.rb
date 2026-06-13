require "rails_helper"

RSpec.describe RoadPoint, type: :model do
  it "有効なファクトリ（空ポイント）" do
    expect(build(:road_point)).to be_valid
  end

  it "item は任意（空ポイントを許容）" do
    point = build(:road_point, item: nil)
    expect(point).to be_valid
  end

  it "position は整数必須" do
    expect(build(:road_point, position: nil)).not_to be_valid
    expect(build(:road_point, position: 1.5)).not_to be_valid
  end
end
