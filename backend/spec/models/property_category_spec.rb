require "rails_helper"

# 項目の役割。**何のために持つのか**で分ける。
#
# 分けないと、覚えるための手立てと、調べた事実が同じ見た目で並ぶ。
# 「語源」と「語呂合わせ」は隣に置くと似て見えるが、
# 前者は**合っているか**が大事で、後者は**思い出せるか**が大事。
RSpec.describe "項目の役割" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def definition(attrs = {})
    user.property_definitions.build({ item_type: item_type, key: "reading", label: "読み仮名", value_type: "text" }.merge(attrs))
  end

  it "既定は「その語のこと」" do
    expect(definition.tap(&:save!).category).to eq("subject")
  end

  it "覚えかた・整理も選べる" do
    expect(definition(key: "mnemonic", category: "mnemonic")).to be_valid
    expect(definition(key: "note", category: "admin")).to be_valid
  end

  it "知らない役割は入らない" do
    expect(definition(category: "なんでも")).not_to be_valid
  end

  it "役割で絞れる" do
    definition(key: "reading", category: "subject").save!
    definition(key: "mnemonic", category: "mnemonic").save!

    expect(PropertyDefinition.of_category("mnemonic").pluck(:key)).to eq([ "mnemonic" ])
  end

  it "自動で用意する項目にも役割が付く" do
    keys = Items::EnsurePropertyDefinitions.call(user: user, item_type_id: item_type.id, keys: %w[reading])

    expect(keys).to eq([ "reading" ])
    expect(user.property_definitions.find_by(key: "reading").category).to eq("subject")
  end
end
