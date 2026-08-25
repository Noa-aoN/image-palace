require "rails_helper"

# 項目ごとの目印の色。**見出しの前に置く小さな丸**。
#
# 役割（記憶要素 / 変換要素 / 管理要素）の色は3つしかないので、
# 同じ役割の中に並ぶ「語源」「品詞」「読み方」は全部同じ色で出る。
# ここは、その人が自分の物差しで付ける印。
RSpec.describe "項目ごとの色" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def definition(attrs = {})
    user.property_definitions.build({ item_type: item_type, key: "origin", label: "語源", value_type: "text" }.merge(attrs))
  end

  # **付けた人が付けたものだけが目立つ**状態を既定にする。
  # 全部に色が付いていると、どれが目印なのかが分からなくなる
  it "既定は無色" do
    expect(definition.tap(&:save!).color).to be_nil
  end

  it "決めた色は入る" do
    PropertyDefinition::COLORS.each do |name|
      expect(definition(key: "c_#{name}", color: name)).to be_valid
    end
  end

  # **画面と同じ並びを持つ。** 片方だけ足すと、選べるのに保存できない色ができる。
  # frontend の test/lib/property-color.test.ts が同じ一覧を固定している
  it "受け付ける色は、画面の一覧と同じ" do
    expect(PropertyDefinition::COLORS).to eq(%w[gold purple blue green red orange pink gray])
  end

  it "知らない色は入らない" do
    expect(definition(color: "たまご色")).not_to be_valid
  end

  # 生の値を持つと、地に載る色味を調整するたびに保存済みの行を書き換えることになる
  it "生の色の値は入らない" do
    expect(definition(color: "#c6a75e")).not_to be_valid
  end

  # 画面の色選びで「なし」に戻したときは空文字で届く
  it "空文字は「外した」として扱う" do
    record = definition(color: "gold")
    record.save!

    record.update!(color: "")

    expect(record.reload.color).to be_nil
  end

  it "色を外しても、ほかの設定は残る" do
    record = definition(color: "blue", category: "mnemonic")
    record.save!

    record.update!(color: nil)

    expect(record.reload.category).to eq("mnemonic")
  end
end
