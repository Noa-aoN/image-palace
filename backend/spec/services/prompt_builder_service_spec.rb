require "rails_helper"

RSpec.describe PromptBuilderService do
  let(:user) { create(:user, :confirmed) }

  describe ".effective_prompt" do
    it "スタイルもカスタムも無ければベーステンプレートでタイトルを包む" do
      item = build(:item, user: user, title: "cat")
      result = described_class.effective_prompt(item)
      expect(result).to include('"cat"')
      expect(result).to include("memorable")
      expect(result).to include("no text")
    end

    it "スタイルプリセットの修飾句を末尾に付与する" do
      item = build(:item, user: user, title: "cat", style: "watercolor")
      result = described_class.effective_prompt(item)
      expect(result).to include('"cat"')
      expect(result).to include("watercolor")
      expect(result).to end_with("in a soft watercolor painting style")
    end

    it "カスタム指示を末尾に付与する" do
      item = build(:item, user: user, title: "cat", custom_prompt: "wearing a hat")
      result = described_class.effective_prompt(item)
      expect(result).to include('"cat"')
      expect(result).to end_with(", wearing a hat")
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
