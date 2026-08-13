require "rails_helper"

# チェックの項目。
#
# **触っていない状態と「切」は違う。** 見て「違う」と決めたのか、
# まだ見ていないのかが読めないと、印を付ける意味が無くなる。
RSpec.describe "チェックの項目" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }
  let!(:definition) do
    user.property_definitions.create!(item_type: item_type, key: "learned", label: "覚えた",
                                      value_type: "boolean", category: "admin")
  end

  def property(input)
    item.item_properties.new(property_definition: definition).tap { |row| row.typed_value = input }
  end

  it "入・切を持てる" do
    expect(property("true").typed_value).to be(true)
    expect(property("false").typed_value).to be(false)
    expect(property(true).typed_value).to be(true)
  end

  it "空で来たら「触っていない」" do
    expect(property("").typed_value).to be_nil
    expect(property(nil).typed_value).to be_nil
  end

  it "「切」は入っていない扱いにしない" do
    expect(property("false")).not_to be_blank_value
    expect(property("")).to be_blank_value
  end

  it "入れたものが保存される" do
    row = property("false")
    row.save!

    expect(row.reload.typed_value).to be(false)
  end

  it "型の一覧に入っている" do
    expect(PropertyDefinition::VALUE_TYPES).to include("boolean")
  end

  it "定義として作れる" do
    expect(definition).to be_valid
    expect(definition.value_type).to eq("boolean")
  end
end
