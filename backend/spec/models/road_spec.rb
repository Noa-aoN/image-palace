require "rails_helper"

RSpec.describe Road, type: :model do
  it "有効なファクトリ" do
    expect(build(:road)).to be_valid
  end

  it "name 必須" do
    expect(build(:road, name: "")).not_to be_valid
  end

  it "ordered スコープは position 順" do
    space = create(:space)
    a = create(:road, space: space, position: 2)
    b = create(:road, space: space, position: 1)
    expect(space.roads.ordered.to_a).to eq([ b, a ])
  end
end
