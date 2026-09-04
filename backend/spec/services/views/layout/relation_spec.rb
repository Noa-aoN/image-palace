require "rails_helper"

# 関係の種類が、図の上でどう振る舞うか。
#
# 判定が7か所に散っていたので、種類を1つ足すたびに7か所を直すことになっていた。
RSpec.describe Views::Layout::Relation do
  describe "段を作らない関係" do
    it "夫婦・兄弟・同一視・対比は、同じ段" do
      %w[spouse sibling equivalent contrast].each do |type|
        expect(described_class.same_level?(type)).to be(true), type
      end
    end

    it "旧データの同列も、同じ段として扱う" do
      expect(described_class.same_level?("peer")).to be(true)
    end

    it "親子や所属は、段を作る" do
      %w[parent belongs_to cause sequence].each do |type|
        expect(described_class.same_level?(type)).to be(false), type
      end
    end
  end

  describe "幹を作る組" do
    it "夫婦だけ" do
      expect(described_class.couple?("spouse")).to be(true)
      expect(described_class.couple?("peer")).to be(true)
    end

    # 兄弟や同一視には子がぶら下がらない
    it "兄弟・同一視は幹を作らない" do
      expect(described_class.couple?("sibling")).to be(false)
      expect(described_class.couple?("equivalent")).to be(false)
    end
  end

  describe "隣どうしにする組" do
    it "夫婦と同一視は隣にする" do
      expect(described_class.adjacent?("spouse")).to be(true)
      expect(described_class.adjacent?("equivalent")).to be(true)
    end

    # 兄弟まで寄せると夫婦と押し合って、どちらも隣り合わなくなる
    it "兄弟は寄せない" do
      expect(described_class.adjacent?("sibling")).to be(false)
    end
  end

  describe "束ねてよいか" do
    # 束ねると、何と何が同じなのか・どれとどれを見比べるのかが読めなくなる
    it "同一視と対比は束ねない" do
      expect(described_class.bundleable?("equivalent")).to be(false)
      expect(described_class.bundleable?("contrast")).to be(false)
    end

    it "親子や所属は束ねられる" do
      expect(described_class.bundleable?("parent")).to be(true)
      expect(described_class.bundleable?("belongs_to")).to be(true)
    end
  end

  describe "並びの絞り込み" do
    let(:relations) do
      [ { from: "a", to: "b", type: "parent" }, { from: "a", to: "c", type: "spouse" },
        { from: "d", to: "e", type: "belongs_to" } ]
    end

    it "段を作る関係だけを残せる" do
      expect(described_class.hierarchical(relations).map { |r| r[:type] }).to eq(%w[parent belongs_to])
    end

    it "同列の関係だけを残せる" do
      expect(described_class.same_level(relations).map { |r| r[:type] }).to eq(%w[spouse])
    end
  end
end
