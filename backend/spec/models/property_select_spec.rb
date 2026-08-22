# frozen_string_literal: true

require "rails_helper"

# 選ぶ項目（`select`）。
#
# **ほかの型と違って、定義側が「何を選べるか」を持つ。**
# 空のまま作れると、開いても選べない欄ができる。
RSpec.describe "選ぶ項目", type: :model do
  let(:user) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  def build_definition(**attrs)
    user.property_definitions.new(
      { item_type: word, key: "status", label: "状態", value_type: "select" }.merge(attrs)
    )
  end

  describe "選択肢" do
    it "1つ以上あれば作れる" do
      expect(build_definition(options: [ "下書き", "完成" ])).to be_valid
    end

    # **空のまま作らせない。** 開いても選べない欄になる
    it "空では作れない" do
      definition = build_definition(options: [])

      expect(definition).not_to be_valid
      expect(definition.errors[:options].join).to include("1つ以上")
    end

    it "空白だけの選択肢は数えない" do
      expect(build_definition(options: [ "  ", "" ])).not_to be_valid
    end

    it "同じものは入れられない" do
      definition = build_definition(options: [ "下書き", "下書き" ])

      expect(definition).not_to be_valid
      expect(definition.errors[:options].join).to include("同じもの")
    end

    # **多すぎると、選ぶより探すほうが大変になる**
    it "数に上限がある" do
      expect(build_definition(options: (1..21).map(&:to_s))).not_to be_valid
      expect(build_definition(options: (1..20).map(&:to_s))).to be_valid
    end

    it "長すぎる選択肢は入れられない" do
      expect(build_definition(options: [ "あ" * 41 ])).not_to be_valid
    end
  end

  # **型を変えたときに、古い選択肢が残らないように**
  describe "ほかの型" do
    it "選択肢は持てない" do
      definition = build_definition(value_type: "text", options: [ "下書き" ])

      expect(definition).not_to be_valid
      expect(definition.errors[:options].join).to include("選ぶ項目にしか")
    end

    it "空なら、これまでどおり作れる" do
      expect(build_definition(value_type: "text", options: [])).to be_valid
    end
  end

  describe "受け取れる型として登録されている" do
    it "select が選べる" do
      expect(PropertyDefinition::VALUE_TYPES).to include("select")
    end
  end
end
