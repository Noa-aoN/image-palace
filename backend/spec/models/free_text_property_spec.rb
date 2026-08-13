require "rails_helper"

# 自由欄。**見出しも中身も自由**に書ける。
#
# 決まった項目に収まらないもの（そのカード限りのメモ・引用・気づき）のために置く。
# 見出しを定義側で決めないので、同じ「自由欄」を何枚か持てる。
RSpec.describe "自由欄" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }
  let!(:definition) do
    user.property_definitions.create!(item_type: item_type, key: "free_1", label: "自由欄",
                                      value_type: "free_text")
  end

  def property(input)
    item.item_properties.new(property_definition: definition).tap { |row| row.typed_value = input }
  end

  it "見出しと中身を持つ" do
    row = property({ "heading" => "覚えるコツ", "body" => "葉緑体を思い浮かべる" })

    expect(row.typed_value).to eq({ "heading" => "覚えるコツ", "body" => "葉緑体を思い浮かべる" })
  end

  it "画面から JSON の文字列で来ても受ける" do
    row = property({ heading: "出典", body: "教科書 p.42" }.to_json)

    expect(row.typed_value["heading"]).to eq("出典")
  end

  it "見出しだけでも残す（中身は後から書く）" do
    expect(property({ "heading" => "あとで書く", "body" => "" })).not_to be_blank_value
  end

  it "中身だけでも残す（見出しを付けないこともある）" do
    expect(property({ "heading" => "", "body" => "ひとこと" })).not_to be_blank_value
  end

  it "どちらも空なら未設定" do
    expect(property({ "heading" => "", "body" => "" })).to be_blank_value
    expect(property(nil)).to be_blank_value
  end

  it "保存して読み直せる" do
    row = property({ "heading" => "覚えるコツ", "body" => "葉緑体" })
    row.save!

    expect(row.reload.typed_value["body"]).to eq("葉緑体")
  end

  it "同じ種別に何枚でも置ける（見出しが定義に縛られないため）" do
    user.property_definitions.create!(item_type: item_type, key: "free_2", label: "自由欄",
                                      value_type: "free_text")

    expect(user.property_definitions.where(value_type: "free_text").count).to eq(2)
  end

  it "長すぎるものは断る" do
    row = property({ "heading" => "見出し", "body" => "あ" * 6000 })

    expect(row).not_to be_valid
  end
end
