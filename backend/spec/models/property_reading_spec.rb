# frozen_string_literal: true

require "rails_helper"

# 言語ごとの読み方を、**ひとつの項目**で持つ。
#
# 並びで持つ（対応表にすると jsonb が鍵の順を保たず、書いた順が失われる）。
#
# 言語ごとに別の定義を作る形にすると、1種別40個の枠を言語の数だけ食うし、
# 基本の言語を変えても何も起きない。
# 1つの項目の中に持てば、**どれを主として出すかは、そのときの基本言語で決まる**
# （値は動かさない）。
RSpec.describe "言語ごとの読み方", type: :model do
  let(:user) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }
  let(:item) { user.items.create!(title: "DNS", item_type: word, generation_status: "completed") }

  let(:definition) do
    user.property_definitions.create!(item_type: word, key: "reading", label: "読み方",
                                      value_type: "reading", category: "subject")
  end

  # **実際の口を通す。** `value=` を直に叩くと整える処理を素通りするので、
  # 画面から来たときと違う結果を見てしまう
  def store(value)
    property = item.item_properties.find_or_initialize_by(property_definition: definition)
    property.typed_value = value
    property.save!
    property.reload.typed_value
  end

  it "型として登録されている" do
    expect(PropertyDefinition::VALUE_TYPES).to include("reading")
  end

  describe "持ち方" do
    def rows(*pairs)
      pairs.map { |lang, text| { "language" => lang, "text" => text } }
    end

    it "言語ごとに持てる" do
      expect(store(rows([ "ja", "でぃーえぬえす" ], [ "en", "dee-en-ess" ])))
        .to eq(rows([ "ja", "でぃーえぬえす" ], [ "en", "dee-en-ess" ]))
    end

    # **書いた順のまま返る。** 対応表で持つと、ここが並び替えられてしまう
    it "書いた順のまま返る" do
      expect(store(rows([ "ja", "かな" ], [ "en", "en" ], [ "es", "es" ]))
        .map { |r| r["language"] }).to eq(%w[ja en es])
    end

    it "文字で来ても受ける（画面からは JSON で送る）" do
      expect(store('[{"language":"ja","text":"でぃーえぬえす"}]'))
        .to eq(rows([ "ja", "でぃーえぬえす" ]))
    end

    # **綴りを揃える。** 揃えないと `ja` と `JA` が別の言語になる
    it "言語の綴りを揃える" do
      expect(store(rows([ "JA", "かな" ], [ " En ", "en" ])).map { |r| r["language"] })
        .to eq(%w[ja en])
    end

    # **こちらが並べた一覧に無い言語も書ける。** 学ぶ言語は人によって違う
    it "知らない言語も書ける" do
      expect(store(rows([ "grc", "古典ギリシア語の読み" ])).map { |r| r["language"] }).to eq([ "grc" ])
    end

    it "綴りに使えない字は落とす" do
      expect(store(rows([ "j@a!", "かな" ])).map { |r| r["language"] }).to eq([ "ja" ])
    end

    it "同じ言語は1つにする" do
      expect(store(rows([ "ja", "さき" ], [ "ja", "あと" ]))).to eq(rows([ "ja", "さき" ]))
    end

    it "空の言語は落とす（書いたのに空、を並べない）" do
      expect(store(rows([ "ja", "かな" ], [ "en", "  " ]))).to eq(rows([ "ja", "かな" ]))
    end

    it "全部空なら、未設定にする" do
      expect(store(rows([ "ja", "" ], [ "en", "" ]))).to be_nil
    end

    # **多すぎると、主にしたいものが埋もれる**
    it "数に上限がある" do
      many = (1..20).map { |i| { "language" => "l#{i}", "text" => "読み#{i}" } }

      expect(store(many).size).to eq(ItemProperty::MAX_READINGS)
    end
  end

  # 空かどうかの判定が効いていないと、空の行が「設定済み」に並ぶ
  describe "空の扱い" do
    it "何も入っていなければ、行を残さない" do
      property = item.item_properties.new(property_definition: definition)
      property.typed_value = []

      expect(property.blank_value?).to be(true)
    end

    it "1つでも書いてあれば残す" do
      property = item.item_properties.new(property_definition: definition)
      property.typed_value = [ { "language" => "ja", "text" => "かな" } ]

      expect(property.blank_value?).to be(false)
    end
  end
end
