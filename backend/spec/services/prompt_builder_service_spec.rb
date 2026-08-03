require "rails_helper"

RSpec.describe PromptBuilderService do
  let(:user) { create(:user, :confirmed) }

  describe ".effective_prompt" do
    it "タイトルを主役に置き、文字回避の軽い指示だけ添える" do
      item = build(:item, user: user, title: "cat")
      result = described_class.effective_prompt(item)
      expect(result).to start_with("cat,")
      expect(result).to end_with(described_class::NO_TEXT_HINT)
    end

    it "端で見切れるのを減らすフレーミング指示を添える" do
      item = build(:item, user: user, title: "cat")
      result = described_class.effective_prompt(item)
      expect(result).to include(described_class::FRAMING_HINT)
    end

    it "スタイルプリセットの修飾句を付与する" do
      item = build(:item, user: user, title: "cat", style: "watercolor")
      result = described_class.effective_prompt(item)
      expect(result).to start_with("cat,")
      expect(result).to include("watercolor")
    end

    it "カスタム指示を付与する" do
      item = build(:item, user: user, title: "cat", custom_prompt: "wearing a hat")
      result = described_class.effective_prompt(item)
      expect(result).to start_with("cat,")
      expect(result).to include("wearing a hat")
    end

    it "スタイルとカスタムの両方を付与する" do
      item = build(:item, user: user, title: "cat", style: "anime", custom_prompt: "wearing a hat")
      result = described_class.effective_prompt(item)
      expect(result).to include("anime")
      expect(result).to include("wearing a hat")
    end

    it "スタイル違いは異なる有効プロンプト（=別キャッシュキー）になる" do
      a = build(:item, user: user, title: "cat", style: "photo")
      b = build(:item, user: user, title: "cat", style: "anime")
      expect(described_class.effective_prompt(a)).not_to eq(described_class.effective_prompt(b))
    end

    it "include_meaning: true で意味・説明を補足として加える" do
      item = build(:item, user: user, title: "apple")
      item.meanings.build(language_code: "ja", definition: "赤い果物", detail_level: "simple")
      result = described_class.effective_prompt(item, include_meaning: true)
      expect(result).to include("赤い果物")
    end

    it "既定（include_meaning 省略）では意味を加えない" do
      item = build(:item, user: user, title: "apple")
      item.meanings.build(language_code: "ja", definition: "赤い果物", detail_level: "simple")
      result = described_class.effective_prompt(item)
      expect(result).not_to include("赤い果物")
    end

    context "情景プロンプトがあるとき" do
      it "単語ではなく情景を主役に置く" do
        item = build(:item, user: user, title: "機会費用", scene_prompt: "a person at a fork in the road")
        result = described_class.effective_prompt(item)
        expect(result).to start_with("a person at a fork in the road,")
        expect(result).not_to include("機会費用")
      end

      it "スタイル・カスタム指示は情景の後ろに従来どおり付く" do
        item = build(:item, user: user, title: "機会費用",
                     scene_prompt: "a person at a fork in the road",
                     style: "watercolor", custom_prompt: "at sunrise")
        result = described_class.effective_prompt(item)
        expect(result).to include("watercolor")
        expect(result).to include("at sunrise")
        expect(result).to end_with(described_class::NO_TEXT_HINT)
      end

      it "情景が空なら従来と一字一句同じ（既存キャッシュを壊さない）" do
        with_scene = build(:item, user: user, title: "cat", scene_prompt: "")
        without = build(:item, user: user, title: "cat")
        expect(described_class.effective_prompt(with_scene)).to eq(described_class.effective_prompt(without))
      end
    end
  end
end
