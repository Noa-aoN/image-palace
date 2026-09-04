require "rails_helper"

# AI へ渡す資料の厚み。
#
# 160字で切っていた頃は「ギリシア神話の主神。天空を司る」までしか渡らず、
# 誰の子で誰と結ばれたのかが書いてあっても届いていなかった。
RSpec.describe "Views::AiEditService へ渡す資料" do
  let(:user) { create(:user) }
  let(:view) { create(:view, user: user, view_type: "freeboard") }

  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def place(title, definition: nil)
    item = create(:item, user: user, item_type: item_type, title: title)
    item.meanings.create!(definition: definition, language_code: "ja") if definition
    create(:view_item, view: view, item: item, x: 0, y: 0)
    item
  end

  # Wikipedia の項目を1つ付ける
  def add_wikipedia(item, raw)
    definition = user.property_definitions.find_or_create_by!(
      item_type: item_type, key: "wikipedia", label: "Wikipedia", value_type: "wikipedia"
    )
    item.item_properties.create!(property_definition: definition, value: { "v" => raw })
  end

  # 送られた資料を捕まえる
  def material(edges: "rebuild")
    sent = nil
    allow(Ai::Chat).to receive(:call) do |**args|
      sent = args[:messages].last[:content]
      { "choices" => [ { "message" => { "content" => "{}" } } ] }
    end
    Views::AiEditService.call(view: view, instruction: "整えて", edges: edges)
    sent
  end

  # 資料の1行から、説明の部分だけ取り出す（「／」の後ろ）
  def excerpt_length(text)
    line = text.lines.find { |l| l.include?("／") }
    line.to_s.split("／").last.to_s.split("（x=").first.to_s.strip.length
  end

  describe "説明の長さ" do
    let(:long) { "ゼウスはクロノスとレアの子であり、ヘラを妻とした。#{'あ' * 400}" }

    it "枚数が少ないときは、厚く渡す" do
      place("ゼウス", definition: long)

      # 冒頭の関係が書かれた部分は、必ず届く
      expect(material).to include("クロノスとレアの子であり、ヘラを妻とした")
    end

    it "厚くしても、際限なく渡さない" do
      place("ゼウス", definition: long)

      expect(material).not_to include("あ" * 401)
    end

    # 線を触らないなら、関係を読み取る必要が無い
    it "線を触らない設定では短く渡す" do
      place("ゼウス", definition: long)

      keep = material(edges: "keep")
      rebuild = material(edges: "rebuild")
      expect(excerpt_length(keep)).to be < excerpt_length(rebuild)
      expect(excerpt_length(keep)).to be <= Views::AiEditService::MEANING_EXCERPT
    end
  end

  describe "説明が空のとき" do
    it "Wikipedia の冒頭で補う" do
      item = place("ヘラ")
      add_wikipedia(item, { "wikipedia_extract" => "ゼウスの正妻であり姉。結婚の女神" }.to_json)

      expect(material).to include("ゼウスの正妻であり姉")
    end

    it "意味が書いてあれば、そちらを使う" do
      item = place("ヘラ", definition: "結婚と家庭の女神")
      add_wikipedia(item, { "wikipedia_extract" => "使われないはずの文" }.to_json)

      result = material
      expect(result).to include("結婚と家庭の女神")
      expect(result).not_to include("使われないはずの文")
    end

    it "読めない値でも落ちない" do
      item = place("ヘラ")
      add_wikipedia(item, "{壊れた")

      expect { material }.not_to raise_error
    end
  end
end
