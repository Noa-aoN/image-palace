require "rails_helper"

# 図の良さを言葉ではなく数で持つ。
# そうすると、案を比べられるし、良くなったのか悪くなったのかを固定できる。
RSpec.describe Views::Layout::Score do
  def box(id, x:, y:, title: id, width: 144, height: 176)
    Views::Layout::Box.new(
      id: id, title: title, x: x, y: y, width: width, height: height,
      footprint_width: Views::Layout::Metrics.title_footprint_width(title)
    )
  end

  def rel(from, to, **rest) = { from: from, to: to }.merge(rest)

  describe "邪魔になるもの" do
    it "カードの重なりを数える" do
      boxes = [ box("a", x: 100, y: 100), box("b", x: 110, y: 100) ]

      expect(described_class.new(boxes: boxes, edges: []).overlaps).to eq(1)
    end

    it "離れていれば数えない" do
      boxes = [ box("a", x: 100, y: 100), box("b", x: 900, y: 100) ]

      expect(described_class.new(boxes: boxes, edges: []).overlaps).to eq(0)
    end

    it "線がカードを横切ることを数える" do
      boxes = [ box("a", x: 0, y: 500), box("邪魔", x: 500, y: 500), box("b", x: 1000, y: 500) ]

      score = described_class.new(boxes: boxes, edges: [ rel("a", "b") ])

      expect(score.edge_card_crossings).to eq(1)
    end

    it "線どうしの交差を数える（端を共有するものは数えない）" do
      boxes = [ box("左上", x: 0, y: 0), box("右下", x: 900, y: 900),
                box("右上", x: 900, y: 0), box("左下", x: 0, y: 900) ]

      crossing = described_class.new(boxes: boxes, edges: [ rel("左上", "右下"), rel("右上", "左下") ])
      shared = described_class.new(boxes: boxes, edges: [ rel("左上", "右下"), rel("左上", "右上") ])

      expect(crossing.edge_crossings).to eq(1)
      expect(shared.edge_crossings).to eq(0)
    end

    # 文字が読めない図は、線が正しくても伝わらない
    it "線の文字どうしの重なりを数える" do
      # 2本の線の中点がほぼ同じ場所に来る（文字が重なる）
      boxes = [ box("a", x: 0, y: 0), box("b", x: 800, y: 0),
                box("c", x: 0, y: 10), box("d", x: 800, y: 10) ]

      score = described_class.new(
        boxes: boxes,
        edges: [ rel("a", "b", label: "から"), rel("c", "d", label: "まで") ]
      )

      expect(score.label_clashes).to be_positive
    end

    it "文字が無い線は数えない" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 800, y: 0) ]

      expect(described_class.new(boxes: boxes, edges: [ rel("a", "b") ]).label_clashes).to eq(0)
    end
  end

  describe "読み筋" do
    # 線は水平・垂直だけで描かれる。軸に乗っていないと階段状に折れる
    it "軸に乗っている線の割合を測る" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 800, y: 0), box("c", x: 400, y: 700) ]

      aligned = described_class.new(boxes: boxes, edges: [ rel("a", "b") ])
      skewed = described_class.new(boxes: boxes, edges: [ rel("a", "c") ])

      expect(aligned.alignment_ratio).to eq(1.0)
      expect(skewed.alignment_ratio).to eq(0.0)
    end

    it "強い関係が近いほど高くなる" do
      near = [ box("a", x: 0, y: 0), box("b", x: 400, y: 0), box("c", x: 2000, y: 0) ]
      far = [ box("a", x: 0, y: 0), box("b", x: 2000, y: 0), box("c", x: 400, y: 0) ]
      edges = [ rel("a", "b", strength: 0.9), rel("a", "c", strength: 0.2) ]

      expect(described_class.new(boxes: near, edges: edges).strength_fit)
        .to be > described_class.new(boxes: far, edges: edges).strength_fit
    end

    it "強さを持たない線ばかりなら加点しない" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 400, y: 0) ]

      expect(described_class.new(boxes: boxes, edges: [ rel("a", "b") ]).strength_fit).to eq(0.0)
    end

    it "同じ群れが近いほど高くなる" do
      groups = [ { members: %w[a b] } ]
      tight = [ box("a", x: 0, y: 0), box("b", x: 300, y: 0), box("c", x: 2000, y: 0) ]
      loose = [ box("a", x: 0, y: 0), box("b", x: 2000, y: 0), box("c", x: 300, y: 0) ]

      expect(described_class.new(boxes: tight, edges: [], groups: groups).group_cohesion)
        .to be > described_class.new(boxes: loose, edges: [], groups: groups).group_cohesion
    end

    it "向きが揃っているほど高くなる" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 0, y: 400), box("c", x: 0, y: 800) ]

      same = described_class.new(boxes: boxes, edges: [ rel("a", "b"), rel("b", "c") ])
      mixed = described_class.new(boxes: boxes, edges: [ rel("a", "b"), rel("c", "b") ])

      expect(same.flow_consistency).to eq(1.0)
      expect(mixed.flow_consistency).to be < 1.0
    end
  end

  describe "総合" do
    it "崩れているほど点が悪くなる" do
      good = [ box("a", x: 0, y: 0), box("b", x: 800, y: 0) ]
      bad = [ box("a", x: 0, y: 0), box("b", x: 10, y: 0) ]
      edges = [ rel("a", "b") ]

      expect(described_class.new(boxes: bad, edges: edges).penalty)
        .to be > described_class.new(boxes: good, edges: edges).penalty
    end

    it "重なりは1つでも重く効く" do
      overlapped = [ box("a", x: 0, y: 0), box("b", x: 10, y: 0) ]

      score = described_class.new(boxes: overlapped, edges: [])

      expect(score.penalty).to be >= described_class::WEIGHT_OVERLAP
    end

    it "読める形で全部返す" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 800, y: 0) ]

      keys = described_class.new(boxes: boxes, edges: [ rel("a", "b") ]).to_h.keys

      expect(keys).to include(:overlaps, :edge_card_crossings, :edge_crossings, :label_clashes,
                              :alignment_ratio, :strength_fit, :group_cohesion, :flow_consistency)
    end
  end

  describe "利用者への一言" do
    it "崩れているところだけ言う" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 10, y: 0) ]

      expect(described_class.new(boxes: boxes, edges: []).notes.first).to include("重なっています")
    end

    it "崩れていなければ何も言わない" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 800, y: 0) ]

      expect(described_class.new(boxes: boxes, edges: [ rel("a", "b") ]).notes).to be_empty
    end
  end

  describe "カードが無いとき" do
    it "落ちない" do
      expect { described_class.new(boxes: [], edges: []).to_h }.not_to raise_error
    end
  end
end
