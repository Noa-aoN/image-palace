require "rails_helper"

# 調べた結果（Wikipedia の冒頭）を、書くときの下敷きにする。
#
# **写させない。** 引き写すと、出どころの分からない文がカードに残る
# （Wikipedia の文には条件が付く）。読んで、この製品の言葉で書き直させる。
# 下敷きがあるぶん、作り話が混ざりにくくもなる。
RSpec.describe "調べた結果を下敷きにする" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }

  let(:extract) { "光合成は、植物が光のエネルギーを使って二酸化炭素と水から有機物を作る反応である。" }

  before do
    user.grant_credits!(1000, kind: "campaign", expires_at: 1.month.from_now)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
    allow(Moderation::PromptModerator).to receive(:call).and_return(double(allowed?: true))
  end

  def add_wikipedia!(text)
    definition = user.property_definitions.create!(
      item_type: item_type, key: "wikipedia", label: "Wikipedia", value_type: "wikipedia"
    )
    item.item_properties.create!(
      property_definition: definition,
      value: { "v" => { wikipedia_title: "光合成", wikipedia_extract: text, wikipedia_url: "https://ja.wikipedia.org/wiki/光合成" }.to_json }
    )
  end

  def sent_message(&block)
    captured = nil
    allow(Ai::Chat).to receive(:call) do |args|
      captured = args[:messages].map { |m| m[:content] }.join("\n")
      { "choices" => [ { "message" => { "content" => { definition: "植物が光で栄養を作る仕組み。" }.to_json } } ], "usage" => {} }
    end
    block.call
    captured
  end

  describe "意味・説明を書くとき" do
    it "調べた結果があれば渡す" do
      add_wikipedia!(extract)

      message = sent_message { GenerateMeaningService.call(item: item.reload) }

      expect(message).to include(extract)
      expect(message).to include("書き写さず")
    end

    it "持っていなければ、これまでどおり単語だけを渡す" do
      message = sent_message { GenerateMeaningService.call(item: item) }

      expect(message).to include("光合成")
      expect(message).not_to include("調べた結果")
    end

    it "調べた結果が空なら渡さない" do
      add_wikipedia!("")

      message = sent_message { GenerateMeaningService.call(item: item.reload) }

      expect(message).not_to include("調べた結果")
    end
  end

  describe "項目を埋めるとき" do
    let!(:reading) do
      user.property_definitions.create!(item_type: item_type, key: "reading", label: "読み仮名", value_type: "text")
    end

    it "調べた結果があれば渡す（写さないと書き添える）" do
      add_wikipedia!(extract)

      captured = nil
      allow(Ai::Chat).to receive(:call) do |args|
        captured = args[:messages].map { |m| m[:content] }.join("\n")
        { "choices" => [ { "message" => { "content" => { values: { reading: "こうごうせい" } }.to_json } } ], "usage" => {} }
      end
      Items::FillPropertiesService.call(item: item.reload, keys: %w[reading])

      expect(captured).to include(extract)
      expect(captured).to include("書き写さない")
    end
  end
end
