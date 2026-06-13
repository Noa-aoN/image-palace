require "rails_helper"

RSpec.describe ViewItem, type: :model do
  let(:user) { create(:user, :confirmed) }
  let(:view) { create(:view, user: user) }
  let(:item) { create(:item, user: user) }

  it "有効なファクトリ" do
    expect(build(:view_item, view: view, item: item)).to be_valid
  end

  it "同一ビュー内で同じアイテムは重複できない" do
    create(:view_item, view: view, item: item)
    dup = build(:view_item, view: view, item: item)
    expect(dup).not_to be_valid
  end

  it "別ビューなら同じアイテムを配置できる" do
    other_view = create(:view, user: user)
    create(:view_item, view: view, item: item)
    expect(build(:view_item, view: other_view, item: item)).to be_valid
  end

  it "x/y は数値が必須" do
    expect(build(:view_item, view: view, item: item, x: nil)).not_to be_valid
  end

  it "z_index は整数が必須" do
    expect(build(:view_item, view: view, item: item, z_index: 1.5)).not_to be_valid
  end
end
