require "rails_helper"

RSpec.describe Wikipedia::Language do
  describe ".resolve" do
    # 決め方は「カードの言語 → 利用者の表示言語 → ブラウザ → ja」。
    # 上から見て、最初に引けるものを使う
    it "上から順に見て、最初に引ける言語を使う" do
      expect(described_class.resolve("en", "ja")).to eq("en")
    end

    it "引けない候補は飛ばす" do
      expect(described_class.resolve("xx", "ko")).to eq("ko")
    end

    it "候補が無ければ ja" do
      expect(described_class.resolve(nil, "", "xx")).to eq("ja")
    end

    # Wikipedia の版は言語だけで決まる。地域が付いていても同じ版を引く
    it "地域付き（ja-JP / en-US）も受ける" do
      expect(described_class.resolve("en-US")).to eq("en")
      expect(described_class.resolve("ja_JP")).to eq("ja")
    end
  end

  describe ".base_url" do
    it "言語ごとの入口を返す" do
      expect(described_class.base_url("en")).to eq("https://en.wikipedia.org")
    end

    # 何でも受けると xx.wikipedia.org のような存在しないホストを叩きに行く
    it "引けない言語は既定に落とす" do
      expect(described_class.base_url("xx")).to eq("https://ja.wikipedia.org")
    end
  end

  describe ".from_accept_language" do
    it "並びの先頭から、引ける言語を拾う" do
      expect(described_class.from_accept_language("fr-FR,fr;q=0.9,en;q=0.8")).to eq("fr-FR")
    end

    it "引けるものが無ければ nil" do
      expect(described_class.from_accept_language("xx,yy")).to be_nil
    end

    it "空でも落ちない" do
      expect(described_class.from_accept_language(nil)).to be_nil
    end
  end
end
