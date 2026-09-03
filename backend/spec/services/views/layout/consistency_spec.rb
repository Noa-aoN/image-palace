require "rails_helper"

# AI は線を1本ずつ考えるので、図全体として辻褄が合っているかを見ていない。
# 実際に、同じ2枚に「姉妹」と「娘」の両方が付くことがある。
RSpec.describe Views::Layout::Consistency do
  def rel(from, to, type: "related", label: nil)
    { from: from, to: to, type: type, label: label }
  end

  let(:titles) { { "a" => "ゼウス", "b" => "アテナ", "c" => "アレス" } }

  def check(relations) = described_class.new(relations: relations, titles: titles)

  describe "両立しない言葉" do
    # ここが実際に起きていたもの
    it "「姉妹」と「娘」が同じ2枚に付いていたら見つける" do
      issues = check([
        rel("a", "b", type: "parent", label: "娘"),
        rel("a", "b", type: "related", label: "姉妹")
      ]).issues

      expect(issues.map(&:kind)).to include("label_conflict")
      expect(issues.find { |i| i.kind == "label_conflict" }.message).to include("食い違っています")
    end

    it "「親」と「子」が同じ2枚に付いていたら見つける" do
      issues = check([
        rel("a", "b", type: "parent", label: "親"),
        rel("b", "a", type: "parent", label: "子")
      ]).issues

      expect(issues.map(&:kind)).to include("label_conflict")
    end

    it "同じ意味の言葉が2つでも、食い違いとしない" do
      issues = check([
        rel("a", "b", type: "parent", label: "娘"),
        rel("a", "b", type: "parent", label: "子")
      ]).issues

      expect(issues.map(&:kind)).not_to include("label_conflict")
    end

    it "言葉が1つなら何も言わない" do
      expect(check([ rel("a", "b", label: "父") ]).issues).to be_empty
    end
  end

  describe "向きの食い違い" do
    it "互いが互いの親になっていたら見つける" do
      issues = check([
        rel("a", "b", type: "parent", label: "父"),
        rel("b", "a", type: "parent", label: "父")
      ]).issues

      expect(issues.map(&:kind)).to include("directed_conflict")
    end

    it "向きの無い関係は、両方向にあってもよい" do
      issues = check([
        rel("a", "b", type: "contrast"),
        rel("b", "a", type: "contrast")
      ]).issues

      expect(issues.map(&:kind)).not_to include("directed_conflict")
    end
  end

  describe "重なった線" do
    it "同じ2枚に、種類の違う線が2本あれば見つける" do
      issues = check([
        rel("a", "b", type: "parent"),
        rel("a", "b", type: "cause")
      ]).issues

      expect(issues.map(&:kind)).to include("duplicate_pair")
    end

    it "同じ種類が2本なら言わない" do
      issues = check([ rel("a", "b", type: "parent"), rel("a", "b", type: "parent") ]).issues

      expect(issues.map(&:kind)).not_to include("duplicate_pair")
    end
  end

  describe "輪" do
    it "たどると自分の先祖になっていたら見つける" do
      issues = check([
        rel("a", "b", type: "parent"),
        rel("b", "c", type: "parent"),
        rel("c", "a", type: "parent")
      ]).issues

      expect(issues.map(&:kind)).to include("cycle")
    end

    it "まっすぐな親子なら言わない" do
      issues = check([ rel("a", "b", type: "parent"), rel("b", "c", type: "parent") ]).issues

      expect(issues.map(&:kind)).not_to include("cycle")
    end
  end

  describe "伝え方" do
    it "カードの名前で言う" do
      issues = check([
        rel("a", "b", type: "parent", label: "娘"),
        rel("a", "b", type: "related", label: "姉妹")
      ]).issues

      expect(issues.first.message).to include("ゼウス")
      expect(issues.first.message).to include("アテナ")
    end

    it "多すぎるときは5件までにする" do
      relations = (1..20).flat_map do |i|
        [ rel("x#{i}", "y#{i}", type: "parent", label: "親"),
          rel("x#{i}", "y#{i}", type: "related", label: "兄弟") ]
      end
      names = (1..20).to_h { |i| [ "x#{i}", "語#{i}" ] }

      expect(described_class.new(relations: relations, titles: names).notes.size).to eq(5)
    end

    it "食い違いが無ければ何も言わない" do
      expect(check([ rel("a", "b", type: "parent", label: "父") ]).notes).to be_empty
    end
  end

  describe "壊れた入力" do
    it "関係が無くても落ちない" do
      expect { described_class.new(relations: []).issues }.not_to raise_error
    end

    it "名前が分からなくても落ちない" do
      expect(described_class.new(relations: [ rel("a", "b", type: "parent", label: "親"),
                                              rel("a", "b", type: "related", label: "兄") ]).notes)
        .to all(include("カード"))
    end
  end
end
