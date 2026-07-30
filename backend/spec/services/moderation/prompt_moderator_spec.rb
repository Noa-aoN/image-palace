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

  # 2段目（OpenAI Moderation API）との連携。API 自体の判定ロジックは openai_moderator_spec 側で検証する
  describe "OpenAI Moderation との2段構成" do
    it "ブロックリストに当たった時点で OpenAI を呼ばない" do
      allow(Moderation::OpenaiModerator).to receive(:call)

      expect(described_class.call("a cute loli character")).to be_blocked
      expect(Moderation::OpenaiModerator).not_to have_received(:call)
    end

    it "ブロックリストを通ったら OpenAI に問い合わせる" do
      allow(Moderation::OpenaiModerator).to receive(:call)
        .and_return(Moderation::OpenaiModerator::Result.new(allowed: true))

      expect(described_class.call("photosynthesis")).to be_allowed
      expect(Moderation::OpenaiModerator).to have_received(:call).with("photosynthesis")
    end

    it "OpenAI がブロックしたら category にプレフィックスを付けて返す" do
      allow(Moderation::OpenaiModerator).to receive(:call)
        .and_return(Moderation::OpenaiModerator::Result.new(allowed: false, category: "sexual/minors", score: 0.9))

      result = described_class.call("見た目は無害な言い換え")

      expect(result).to be_blocked
      expect(result.category).to eq("openai:sexual/minors")
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
