require "rails_helper"

RSpec.describe Moderation::PromptModerator, type: :service do
  describe ".call" do
    it "通常の単語は許可する" do
      result = described_class.call("photosynthesis")
      expect(result).to be_allowed
      expect(result.category).to be_nil
    end

    it "空文字・nil は許可する" do
      expect(described_class.call("")).to be_allowed
      expect(described_class.call(nil)).to be_allowed
    end

    it "禁止語（英語）を含む入力をブロックする" do
      result = described_class.call("a cute loli character")
      expect(result).to be_blocked
      expect(result.category).to eq("latin")
    end

    it "禁止語（日本語）を含む入力をブロックする" do
      result = described_class.call("レイプの場面")
      expect(result).to be_blocked
      expect(result.category).to eq("cjk")
    end

    it "大文字・全角を正規化してブロックする" do
      result = described_class.call("ＲＡＰＥ")
      expect(result).to be_blocked
    end

    it "禁止語を部分として含む無害な語は誤検知しない（単語境界）" do
      # "rape" を含むが別語の "grape" / "drape" は許可
      expect(described_class.call("grape")).to be_allowed
      expect(described_class.call("drapery")).to be_allowed
    end
  end

  describe ".blocklist" do
    it "ファイルが無い場合は空リストにフォールバックする" do
      described_class.reset_blocklist!
      allow(described_class).to receive(:load_blocklist).and_call_original
      stub_const("#{described_class}::BLOCKLIST_PATH", Rails.root.join("config", "does_not_exist.yml"))

      expect(described_class.blocklist).to eq(latin: [], cjk: [])
    ensure
      described_class.reset_blocklist!
    end
  end
end
