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
  end
end
