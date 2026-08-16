require "rails_helper"

# 種別の品揃え。
#
# **種別は持てる項目を決める。** ここが粗いと、人物にも出来事にも語の項目が並ぶ。
# 逆に増やしすぎると、選ぶ側も判定する側も迷う。
RSpec.describe "種別の品揃え" do
  # seeds の定義をそのまま読む（画面や AI の指示に書き写さないため）
  let(:seeded) do
    path = Rails.root.join("db/seeds.rb")
    path.read[/item_types_data = \[(.*?)\n\]/m, 1].to_s.scan(/name: "(\w+)", label: "(.+?)"/)
  end

  it "10 種別ある" do
    expect(seeded.size).to eq(10)
  end

  it "識別名が重複していない" do
    names = seeded.map(&:first)

    expect(names.uniq.size).to eq(names.size)
  end

  # 名前を変えると、AI の指示（識別名で書いてある）と食い違う
  it "これまでの5つの識別名を変えていない" do
    expect(seeded.map(&:first).first(5)).to eq(%w[term concept entity person event])
  end

  it "追加した5つが入っている" do
    expect(seeded.map(&:first)).to include("place", "work", "organization", "task", "record")
  end

  # 判定の指示に書いていない種別があると、その種別は永久に選ばれない
  it "すべての種別が、判定の指示に書いてある" do
    prompt = Cards::DetectItemTypeService::SYSTEM_PROMPT
    missing = seeded.map(&:first).reject { |name| prompt.include?(name) }

    expect(missing).to be_empty
  end

  it "seed を2回流しても増えない" do
    load Rails.root.join("db/seeds.rb").to_s
    expect { load Rails.root.join("db/seeds.rb").to_s }.not_to change(ItemType, :count)
  end
end
