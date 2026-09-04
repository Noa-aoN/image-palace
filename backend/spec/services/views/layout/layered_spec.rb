require "rails_helper"

# 家系図が家系図に見えるかどうかは、3つの決めごとを全部守れるかで決まる。
#
#   1. 同じ深さのものは、同じ高さに並ぶ
#   2. 兄弟は左から順に、重ならずに並ぶ
#   3. 親は、子たちの真ん中の上に来る
#
# これまでは日本語で AI に頼んでいて、守られるかは運任せだった。
RSpec.describe Views::Layout::Layered do
  def box(id, title: id, width: 144, height: 176)
    Views::Layout::Box.new(
      id: id, title: title, x: 0, y: 0, width: width, height: height,
      footprint_width: Views::Layout::Metrics.title_footprint_width(title)
    )
  end

  def rel(from, to) = { from: from, to: to }

  describe "深さ" do
    it "同じ深さのものは、同じ高さに並ぶ" do
      boxes = %w[親 子1 子2 孫].map { |id| box(id) }
      described_class.new(
        boxes: boxes, edges: [ rel("親", "子1"), rel("親", "子2"), rel("子1", "孫") ]
      ).call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["子1"].y).to eq(at["子2"].y)
      expect(at["子1"].y).to be > at["親"].y
      expect(at["孫"].y).to be > at["子1"].y
    end

    it "深さが1つ下がるごとに、同じだけ下がる" do
      boxes = %w[a b c].map { |id| box(id) }
      described_class.new(boxes: boxes, edges: [ rel("a", "b"), rel("b", "c") ]).call
      at = boxes.to_h { |x| [ x.id, x ] }

      expect(at["b"].y - at["a"].y).to eq(at["c"].y - at["b"].y)
    end
  end

  describe "兄弟の並び" do
    it "重ならず、間隔をあけて並ぶ" do
      boxes = %w[親 子1 子2 子3].map { |id| box(id) }
      described_class.new(
        boxes: boxes, edges: %w[子1 子2 子3].map { |c| rel("親", c) }
      ).call
      children = boxes.reject { |b| b.id == "親" }.sort_by(&:x)

      children.each_cons(2) do |left, right|
        expect(right.left - left.right).to be >= Views::Layout::Metrics::MIN_CARD_GAP
      end
    end

    it "長い見出しのカードは、そのぶん広く場所を取る" do
      boxes = [ box("親"), box("短", title: "あ"), box("長", title: "とても長い見出しの語である") ]
      described_class.new(boxes: boxes, edges: [ rel("親", "短"), rel("親", "長") ]).call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["長"].footprint_width).to be > at["短"].footprint_width
      expect((at["長"].center_x - at["短"].center_x).abs)
        .to be >= (at["長"].footprint_width + at["短"].footprint_width) / 2
    end
  end

  # ここが要。これが崩れると家系図に見えない
  describe "親は子の真ん中の上" do
    it "子が2つなら、その中間に来る" do
      boxes = %w[親 子1 子2].map { |id| box(id) }
      described_class.new(boxes: boxes, edges: [ rel("親", "子1"), rel("親", "子2") ]).call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["親"].center_x).to be_within(1).of((at["子1"].center_x + at["子2"].center_x) / 2)
    end

    it "子が3つでも、両端の中間に来る" do
      boxes = %w[親 c1 c2 c3].map { |id| box(id) }
      described_class.new(boxes: boxes, edges: %w[c1 c2 c3].map { |c| rel("親", c) }).call
      at = boxes.to_h { |b| [ b.id, b ] }
      ends = %w[c1 c2 c3].map { |c| at[c].center_x }

      expect(at["親"].center_x).to be_within(1).of((ends.min + ends.max) / 2)
    end

    it "子が1つなら、真上に来る" do
      boxes = %w[親 子].map { |id| box(id) }
      described_class.new(boxes: boxes, edges: [ rel("親", "子") ]).call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["親"].center_x).to be_within(1).of(at["子"].center_x)
    end

    it "孫がいても、各段で中間に来る" do
      boxes = %w[祖 親1 親2 孫1 孫2].map { |id| box(id) }
      described_class.new(
        boxes: boxes,
        edges: [ rel("祖", "親1"), rel("祖", "親2"), rel("親1", "孫1"), rel("親1", "孫2") ]
      ).call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["親1"].center_x).to be_within(1).of((at["孫1"].center_x + at["孫2"].center_x) / 2)
      expect(at["祖"].center_x).to be_within(1).of((at["親1"].center_x + at["親2"].center_x) / 2)
    end
  end

  describe "壊れた入力" do
    it "輪になっていても図にする（たどり続けない）" do
      boxes = %w[a b c].map { |id| box(id) }

      expect {
        described_class.new(boxes: boxes, edges: [ rel("a", "b"), rel("b", "c"), rel("c", "a") ]).call
      }.not_to raise_error
      expect(boxes.map(&:y).uniq.size).to be >= 2
    end

    it "つながりの無いカードも置く（消さない）" do
      boxes = %w[親 子 孤].map { |id| box(id) }
      described_class.new(boxes: boxes, edges: [ rel("親", "子") ]).call

      expect(boxes.map(&:id)).to include("孤")
      expect(boxes.find { |b| b.id == "孤" }.y).to be >= 0
    end

    it "知らない id の線は無視する" do
      boxes = [ box("a") ]

      expect { described_class.new(boxes: boxes, edges: [ rel("a", "居ない") ]).call }.not_to raise_error
    end

    it "カードが1枚でも置ける" do
      boxes = [ box("a") ]
      described_class.new(boxes: boxes, edges: []).call

      expect(boxes.first.x).to be >= 0
    end
  end

  describe "同じ入力からは同じ図" do
    it "何度呼んでも座標が一致する" do
      edges = [ rel("親", "子1"), rel("親", "子2"), rel("子1", "孫") ]
      first = %w[親 子1 子2 孫].map { |id| box(id) }
      second = %w[親 子1 子2 孫].map { |id| box(id) }

      described_class.new(boxes: first, edges: edges).call
      described_class.new(boxes: second, edges: edges).call

      expect(first.map(&:to_placement)).to eq(second.map(&:to_placement))
    end
  end

  describe "横に流す" do
    it "深さが右へ伸びる" do
      boxes = %w[a b].map { |id| box(id) }
      described_class.new(boxes: boxes, edges: [ rel("a", "b") ], horizontal: true).call
      at = boxes.to_h { |x| [ x.id, x ] }

      expect(at["b"].x).to be > at["a"].x
      expect(at["b"].y).to be_within(1).of(at["a"].y)
    end
  end
  # AI が挙げる根は「いちばん上に置きたいもの」の助言であって、
  # 親を持たないものの全部ではない
  describe "親を持たないもの" do
    it "挙げられていなくても、最上段に置く" do
      boxes = %w[父 母 子].map { |id| box(id) }
      described_class.new(
        boxes: boxes, edges: [ rel("父", "子"), rel("母", "子") ], roots: [ "父" ]
      ).call
      at = boxes.to_h { |b| [ b.id, b ] }

      # 母は挙げられていないが、子より下へは行かない
      expect(at["母"].y).to eq(at["父"].y)
      expect(at["子"].y).to be > at["母"].y
    end

    it "親が2人いる子は、両方の下に来る" do
      boxes = %w[父 母 子].map { |id| box(id) }
      described_class.new(boxes: boxes, edges: [ rel("父", "子"), rel("母", "子") ]).call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["子"].y).to be > at["父"].y
      expect(at["子"].y).to be > at["母"].y
    end
  end
end

# 同列の関係（兄弟・配偶者）は、段を作らない。
#
# ここを取り違えていた頃は、ゼウスの「妻」であるヘラや「兄弟」であるポセイドンが
# 子と同じ段へ落ち、そこから子へ引かれた線が子の段を横切っていた。
RSpec.describe "#{Views::Layout::Layered} 同列の関係" do
  def box(id, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: 0, y: 0, width: width, height: height, footprint_width: width)
  end

  def levels_of(boxes)
    boxes.group_by(&:y).sort_by(&:first).map { |_, group| group.map(&:id).sort }
  end

  # ゼウス：妻ヘラ（同列）・兄弟ポセイドン（同列）・娘アルテミス（親子）
  # ヘラ：子アレス（親子）
  let(:boxes) { %w[ゼウス ヘラ ポセイドン アルテミス アレス].map { |id| box(id) } }
  let(:edges) do
    [
      { from: "ゼウス", to: "ヘラ", type: "peer" },
      { from: "ゼウス", to: "ポセイドン", type: "peer" },
      { from: "ゼウス", to: "アルテミス", type: "parent" },
      { from: "ヘラ", to: "アレス", type: "parent" }
    ]
  end

  it "配偶者と兄弟は、同じ段に並ぶ" do
    result = Views::Layout::Layered.new(boxes: boxes, edges: edges, roots: [ "ゼウス" ]).call

    expect(levels_of(result).first).to eq(%w[ゼウス ヘラ ポセイドン])
  end

  it "子だけが下の段へ行く" do
    result = Views::Layout::Layered.new(boxes: boxes, edges: edges, roots: [ "ゼウス" ]).call

    expect(levels_of(result).last).to eq(%w[アルテミス アレス])
  end

  it "段は2つだけになる（同列が段を増やさない）" do
    result = Views::Layout::Layered.new(boxes: boxes, edges: edges, roots: [ "ゼウス" ]).call

    expect(levels_of(result).size).to eq(2)
  end

  # 上下の関係を1本も持たないカードでも、兄弟が居れば居場所は決まる
  it "同列の関係しか持たないカードが、最下段へ落ちない" do
    result = Views::Layout::Layered.new(boxes: boxes, edges: edges, roots: [ "ゼウス" ]).call
    poseidon = result.find { |b| b.id == "ポセイドン" }
    zeus = result.find { |b| b.id == "ゼウス" }

    expect(poseidon.y).to eq(zeus.y)
  end

  # 親を持つカードを兄弟に合わせて動かすと、その親との上下が壊れる
  it "親を持つカードは、同列の相手につられて上がらない" do
    with_parent = boxes + [ box("ヘパイストス") ]
    result = Views::Layout::Layered.new(
      boxes: with_parent,
      edges: edges + [
        { from: "ヘラ", to: "ヘパイストス", type: "parent" },
        { from: "ヘパイストス", to: "ゼウス", type: "peer" }
      ],
      roots: [ "ゼウス" ]
    ).call

    hephaestus = result.find { |b| b.id == "ヘパイストス" }
    zeus = result.find { |b| b.id == "ゼウス" }
    expect(hephaestus.y).to be > zeus.y
  end

  it "同列の相手は、並びの中で隣どうしに寄る" do
    wide = %w[ゼウス ヘラ A B C].map { |id| box(id) }
    result = Views::Layout::Layered.new(
      boxes: wide,
      edges: [
        { from: "ゼウス", to: "A", type: "parent" },
        { from: "ゼウス", to: "B", type: "parent" },
        { from: "ゼウス", to: "C", type: "parent" },
        { from: "ゼウス", to: "ヘラ", type: "peer" }
      ],
      roots: [ "ゼウス" ]
    ).call

    top = result.select { |b| b.y == result.min_by(&:y).y }.sort_by(&:x).map(&:id)
    expect(top).to contain_exactly("ゼウス", "ヘラ")
  end
end
