require "rails_helper"

# 図の質を、判断基準に沿って点数にする。
#
# **測るのは実物**。線は Router が引く折れ線、文字は LabelPlacement が置く矩形。
# 両端を結ぶ直線で近似していた頃は、測っている図と目に見える図が別物だった。
RSpec.describe Views::Layout::Score do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  def rel(from, to, type: "parent", label: nil, strength: 0.8)
    { from: from, to: to, type: type, label: label, strength: strength }
  end

  # 実際に引かれる線を組んでから採点する（Planner がやっているのと同じ手順）
  def score(boxes, edges, **options)
    lines = Views::Layout::Geometry.call(boxes: boxes, relations: edges)
    described_class.new(boxes: boxes, edges: edges, lines: lines, **options)
  end

  # 親1枚と子2枚の、いちばん素直な形
  let(:tidy_boxes) { [ box("親", x: 400, y: 0), box("子1", x: 200, y: 400), box("子2", x: 600, y: 400) ] }
  let(:tidy_edges) { [ rel("親", "子1", label: "子"), rel("親", "子2", label: "子") ] }

  describe "判断基準" do
    it "4群14項目で、合計100点になる" do
      expect(described_class::ITEMS.sum { |item| item[:points] }).to eq(100)
      expect(described_class::ITEMS.map { |item| item[:group] }.uniq)
        .to match_array(described_class::GROUPS.keys)
    end

    it "整った図は高い点になる" do
      expect(score(tidy_boxes, tidy_edges).points).to be >= 85
    end

    it "点数は0〜100に収まる" do
      messy = [ box("a", x: 0, y: 0), box("b", x: 10, y: 10), box("c", x: 20, y: 20) ]
      edges = [ rel("a", "b", type: "related"), rel("b", "c", type: "related"), rel("c", "a", type: "related") ]

      expect(score(messy, edges).points).to be_between(0, 100)
    end

    it "群ごとの内訳を返し、満点の項目は並べない" do
      breakdown = score(tidy_boxes, tidy_edges).breakdown
      semantics = breakdown.find { |group| group[:group] == :semantics }

      expect(semantics[:max]).to eq(30)
      expect(semantics[:points]).to eq(30)
      expect(semantics[:weak]).to be_empty
    end
  end

  describe "A 意味の正しさ" do
    it "食い違いがあると下がる" do
      issue = Views::Layout::Consistency::Issue.new(kind: "label_conflict", from: "親", to: "子1", message: "x")

      clean = score(tidy_boxes, tidy_edges)
      dirty = score(tidy_boxes, tidy_edges, issues: [ issue ])

      expect(dirty.ratios[:no_contradiction]).to be < clean.ratios[:no_contradiction]
      expect(dirty.points).to be < clean.points
    end

    it "線に繋がらないカードがあると下がる" do
      with_orphan = tidy_boxes + [ box("孤島", x: 1200, y: 400) ]

      expect(score(with_orphan, tidy_edges).ratios[:connectedness]).to be < 1.0
    end

    # 親子や同列を related へ逃がしていないか
    it "「その他」ばかりの関係は下がる" do
      vague = tidy_edges.map { |edge| edge.merge(type: "related") }

      expect(score(tidy_boxes, vague).ratios[:specific_types]).to eq(0.0)
      expect(score(tidy_boxes, tidy_edges).ratios[:specific_types]).to eq(1.0)
    end
  end

  describe "B 読みやすさ" do
    it "重なりは1つでも大きく落とす" do
      overlapping = [ box("a", x: 300, y: 300), box("b", x: 310, y: 300) ]

      result = score(overlapping, [])
      expect(result.overlaps).to be_positive
      expect(result.ratios[:no_overlap]).to eq(0.0)
    end

    # 実際に引かれる折れ線で測る（両端を結ぶ直線ではなく）
    it "線がカードを横切ったら数える" do
      # 親と子の間に、よけようのないカードを挟む
      blocked = tidy_boxes + [ box("壁", x: 380, y: 180, width: 900, height: 100) ]
      result = score(blocked, tidy_edges)

      expect(result.counts).to have_key(:edge_card_crossings)
      expect(result.ratios[:edge_card_clear]).to be <= 1.0
    end

    it "文字が読めるかを、置かれる矩形で見る" do
      result = score(tidy_boxes, tidy_edges)

      expect(result.label_clashes).to eq(0)
      expect(result.ratios[:label_readable]).to eq(1.0)
    end
  end

  describe "C 図の作法" do
    it "親が子の中央にあれば満点になる" do
      expect(score(tidy_boxes, tidy_edges).ratios[:parent_centered]).to eq(1.0)
    end

    it "親が子の中央から外れると下がる" do
      lopsided = [ box("親", x: 0, y: 0), box("子1", x: 600, y: 400), box("子2", x: 1000, y: 400) ]

      expect(score(lopsided, tidy_edges).ratios[:parent_centered]).to be < 1.0
    end

    it "同列の関係が同じ高さにあれば満点になる" do
      couple = [ box("夫", x: 200, y: 0), box("妻", x: 500, y: 0) ]
      edges = [ rel("夫", "妻", type: "peer", label: "妻") ]

      expect(score(couple, edges).ratios[:level_aligned]).to eq(1.0)
    end

    it "同列なのに段が違うと下がる" do
      split = [ box("夫", x: 200, y: 0), box("妻", x: 500, y: 400) ]
      edges = [ rel("夫", "妻", type: "peer", label: "妻") ]

      expect(score(split, edges).ratios[:level_aligned]).to eq(0.0)
    end

    # 夫婦が隣り合い、子が二人の間から降りる（参考図の作法）
    it "夫婦が隣り合っていれば、作法の点が付く" do
      family = [ box("父", x: 300, y: 0), box("母", x: 600, y: 0), box("子", x: 450, y: 400) ]
      edges = [ rel("父", "母", type: "peer"), rel("父", "子"), rel("母", "子") ]

      expect(score(family, edges).ratios[:couple_bus]).to be > 0.0
    end

    it "夫婦の間に別のカードが挟まると下がる" do
      family = [ box("父", x: 300, y: 0), box("邪魔", x: 600, y: 0), box("母", x: 900, y: 0),
                 box("子", x: 600, y: 400) ]
      edges = [ rel("父", "母", type: "peer"), rel("父", "子"), rel("母", "子") ]

      apart = score(family, edges)
      together = score(
        [ box("父", x: 300, y: 0), box("母", x: 600, y: 0), box("子", x: 450, y: 400) ],
        edges
      )
      expect(apart.ratios[:couple_bus]).to be < together.ratios[:couple_bus]
    end

    it "曲がりが少ないほど高くなる" do
      straight = [ box("a", x: 400, y: 0), box("b", x: 400, y: 400) ]
      edges = [ rel("a", "b") ]

      expect(score(straight, edges).ratios[:few_bends]).to eq(1.0)
    end
  end

  describe "D 手の入れ具合" do
    it "動かしていなければ満点になる" do
      previous = tidy_boxes.to_h { |b| [ b.id, { x: b.x, y: b.y } ] }

      expect(score(tidy_boxes, tidy_edges, previous: previous).ratios[:stability]).to eq(1.0)
    end

    it "動かすほど下がる" do
      previous = tidy_boxes.to_h { |b| [ b.id, { x: b.x + 800, y: b.y + 800 } ] }

      expect(score(tidy_boxes, tidy_edges, previous: previous).ratios[:stability]).to be < 1.0
    end

    it "同じ群れが近いほど高くなる" do
      near = [ box("a", x: 0, y: 0), box("b", x: 200, y: 0), box("c", x: 2000, y: 2000) ]
      far = [ box("a", x: 0, y: 0), box("b", x: 1800, y: 1800), box("c", x: 2000, y: 2000) ]
      groups = [ { name: "群", members: %w[a b] } ]

      expect(score(near, [], groups: groups).ratios[:group_cohesion])
        .to be > score(far, [], groups: groups).ratios[:group_cohesion]
    end
  end

  describe "伝え方" do
    it "崩れているところだけ言う" do
      expect(score(tidy_boxes, tidy_edges).notes).to be_empty
    end

    it "重なりが残ったら、そう言う" do
      overlapping = [ box("a", x: 300, y: 300), box("b", x: 310, y: 300) ]

      expect(score(overlapping, []).notes.first).to include("重なっています")
    end

    it "内訳の弱い項目には、数の一言が付く" do
      with_orphan = tidy_boxes + [ box("孤島", x: 1200, y: 400) ]
      breakdown = score(with_orphan, tidy_edges).breakdown
      semantics = breakdown.find { |group| group[:group] == :semantics }

      expect(semantics[:weak].map { |item| item[:note] }).to include("1枚が線に繋がっていない")
    end
  end

  describe "線が無くても落ちない" do
    it "カードだけの盤でも点が付く" do
      expect(score([ box("a", x: 0, y: 0) ], []).points).to be_between(0, 100)
    end

    it "カードが1枚も無くても落ちない" do
      expect(described_class.new(boxes: [], edges: []).points).to be_between(0, 100)
    end
  end
end
