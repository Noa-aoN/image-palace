require "rails_helper"

# 意味の当たり具合を測る台。
#
# 「配置は綺麗だが、関係が抜けている」を見つけるための物差しなので、
# **正解を知らない**こと自体を守る（題材の知識はここに入れない）。
RSpec.describe Views::Layout::SemanticScore do
  def relation(from, to, type, strength = 0.9)
    { from: from, to: to, type: type, label: type, strength: strength }
  end

  describe "取りこぼし" do
    it "拾えた分だけ recall が上がる" do
      expected = [ relation("a", "b", "parent"), relation("a", "c", "parent") ]

      result = described_class.call(expected: expected, detected: [ relation("a", "b", "parent") ])

      expect(result.recall).to eq(0.5)
      expect(result.missing.map(&:to_s)).to eq([ "a -[parent]-> c" ])
    end

    it "1本も無ければ 0、全部あれば 1" do
      expected = [ relation("a", "b", "parent") ]

      expect(described_class.call(expected: expected, detected: []).recall).to eq(0.0)
      expect(described_class.call(expected: expected, detected: expected).recall).to eq(1.0)
    end
  end

  describe "作り話" do
    it "正解に無い線は extra に出て、precision が下がる" do
      expected = [ relation("a", "b", "parent") ]
      detected = [ relation("a", "b", "parent"), relation("x", "y", "sibling") ]

      result = described_class.call(expected: expected, detected: detected)

      expect(result.recall).to eq(1.0)
      expect(result.precision).to eq(0.5)
      expect(result.extra.map(&:to_s)).to eq([ "x -[sibling]-> y" ])
    end
  end

  describe "組は合っているが、種類や向きが違う" do
    it "種類違いは当たりにしないが、繋がってはいるので pair_recall には入る" do
      result = described_class.call(
        expected: [ relation("a", "b", "parent") ],
        detected: [ relation("a", "b", "sibling") ]
      )

      expect(result.recall).to eq(0.0)
      expect(result.pair_recall).to eq(1.0)
      expect(result.wrong_type.size).to eq(1)
    end

    it "上下のある関係は、逆向きを当たりにしない" do
      result = described_class.call(
        expected: [ relation("a", "b", "parent") ],
        detected: [ relation("b", "a", "parent") ]
      )

      expect(result.recall).to eq(0.0)
      expect(result.wrong_direction.size).to eq(1)
    end

    # 夫婦・兄弟・同一視は、どちらから書いても同じことを言っている
    it "同列の関係は、どちら向きでも当たりにする" do
      result = described_class.call(
        expected: [ relation("a", "b", "spouse") ],
        detected: [ relation("b", "a", "spouse") ]
      )

      expect(result.recall).to eq(1.0)
    end
  end

  describe "数え方" do
    it "同じ組が2度出てきても1本として数える" do
      detected = [ relation("a", "b", "parent"), relation("b", "a", "parent") ]

      expect(described_class.call(expected: [], detected: detected).detected).to eq(1)
    end

    it "文字列の鍵でも記号の鍵でも同じに読む" do
      result = described_class.call(
        expected: [ { "from" => "a", "to" => "b", "type" => "parent" } ],
        detected: [ relation("a", "b", "parent") ]
      )

      expect(result.recall).to eq(1.0)
    end

    it "正解が無ければ 0 を返す（0除算しない）" do
      expect(described_class.call(expected: [], detected: []).recall).to eq(0.0)
    end
  end
end
