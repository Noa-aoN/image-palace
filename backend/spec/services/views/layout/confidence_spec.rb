require "rails_helper"

# 確からしさが足りない関係は、線にしない。
#
# 図は「そう読める」と言い切るものなので、弱い推測を線にすると嘘になる。
RSpec.describe Views::Layout::Confidence do
  describe "下限" do
    it "決めが無い種類には、共通の下限を使う" do
      expect(described_class.threshold_for("しらない種類")).to eq(described_class::MINIMUM)
    end

    # 「AはBの親だ」は間違っていれば誤り。「AはBと関係がある」は幅がある
    it "事実を言う関係ほど、高い確からしさを求める" do
      expect(described_class.threshold_for("parent")).to be > described_class.threshold_for("related")
      expect(described_class.threshold_for("spouse")).to be > described_class.threshold_for("related")
      expect(described_class.threshold_for("equivalent")).to be > described_class.threshold_for("parent")
    end

    it "種類ごとに変えられる（1か所にまとまっている）" do
      expect(described_class::THRESHOLDS).to include("parent", "spouse", "sibling", "equivalent", "belongs_to")
    end
  end

  describe "線にしてよいか" do
    it "下限に届いていれば通す" do
      expect(described_class.enough?("parent", 0.9)).to be(true)
    end

    it "届いていなければ止める" do
      expect(described_class.enough?("parent", 0.4)).to be(false)
    end

    it "ちょうど下限なら通す" do
      expect(described_class.enough?("parent", described_class.threshold_for("parent"))).to be(true)
    end

    # 古い応答には strength が無い。**無いことを「弱い」とは読まない**
    it "確からしさが無いものは通す" do
      expect(described_class.enough?("parent", nil)).to be(true)
    end

    it "同じ確からしさでも、種類で結果が変わる" do
      expect(described_class.enough?("related", 0.45)).to be(true)
      expect(described_class.enough?("parent", 0.45)).to be(false)
    end
  end
end
