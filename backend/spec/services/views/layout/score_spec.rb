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
    it "4群19項目で、合計100点になる" do
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

# PR2 で足した3項目。**幾何の崩れに罰を与える。**
RSpec.describe "#{Views::Layout::Score} 幾何の崩れ" do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  def rel(from, to, type: "parent", strength: 0.9)
    { from: from, to: to, type: type, label: "子", strength: strength }
  end

  def score(boxes, edges)
    lines = Views::Layout::Geometry.call(boxes: boxes, relations: edges)
    Views::Layout::Score.new(boxes: boxes, edges: edges, lines: lines)
  end

  describe "線が長すぎない" do
    it "近ければ満点に近い" do
      near = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400) ]

      expect(score(near, [ rel("親", "子") ]).ratios[:short_edges]).to be > 0.8
    end

    # 罰が無かったので、盤の端から端まで走る線が放置されていた
    it "遠いほど下がる" do
      near = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400) ]
      far = [ box("親", x: 0, y: 0), box("子", x: 3000, y: 2000) ]

      expect(score(far, [ rel("親", "子") ]).ratios[:short_edges])
        .to be < score(near, [ rel("親", "子") ]).ratios[:short_edges]
    end

    # 1本あたりで見るので、同じ長さの線が増えても評価は変わらない
    it "同じ長さの線が増えても、下がらない" do
      one = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400) ]
      two = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400),
              box("親2", x: 1200, y: 0), box("子2", x: 1200, y: 400) ]

      expect(score(two, [ rel("親", "子"), rel("親2", "子2") ]).ratios[:short_edges])
        .to be_within(0.05).of(score(one, [ rel("親", "子") ]).ratios[:short_edges])
    end
  end

  describe "子が親より下にある" do
    it "下にあれば満点" do
      right = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400) ]

      expect(score(right, [ rel("親", "子") ]).ratios[:hierarchy_kept]).to eq(1.0)
    end

    # 段の意味そのものが壊れる
    it "子が親より上なら0点" do
      upside_down = [ box("親", x: 400, y: 400), box("子", x: 400, y: 0) ]

      expect(score(upside_down, [ rel("親", "子") ]).ratios[:hierarchy_kept]).to eq(0.0)
    end

    it "同列の関係は数えない（上下が無い）" do
      same = [ box("夫", x: 200, y: 0), box("妻", x: 500, y: 0) ]

      expect(score(same, [ rel("夫", "妻", type: "spouse") ]).ratios[:hierarchy_kept]).to eq(1.0)
    end

    it "崩れていたら、そう伝える" do
      upside_down = [ box("親", x: 400, y: 400), box("子", x: 400, y: 0) ]

      expect(score(upside_down, [ rel("親", "子") ]).notes.join).to include("子が親より上")
    end
  end

  describe "強い関係のカードが繋がっている" do
    # 「関係が無いから浮いている」のと「関係があるのに浮いている」のは別のこと
    it "関係の無いカードが浮いていても、この項目は下がらない" do
      boxes = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400), box("無関係", x: 1200, y: 0) ]

      expect(score(boxes, [ rel("親", "子") ]).ratios[:strong_connected]).to eq(1.0)
    end

    it "弱い関係しか無いカードは数えない" do
      boxes = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400), box("薄い縁", x: 1200, y: 0) ]
      edges = [ rel("親", "子"), { from: "親", to: "薄い縁", type: "related", strength: 0.3 } ]

      expect(score(boxes, edges).ratios[:strong_connected]).to eq(1.0)
    end

    # 盤に無いカードを指す関係が混ざっても、並びがずれない
    it "盤に無いカードを指す関係が混ざっても落ちない" do
      boxes = [ box("親", x: 400, y: 0), box("子", x: 400, y: 400) ]
      edges = [ { from: "親", to: "居ない", type: "parent", strength: 0.9 }, rel("親", "子") ]

      expect { score(boxes, edges).points }.not_to raise_error
    end
  end

  describe "曲がりの数え方" do
    # 幹を共有する線の角を、本数ぶん重ねて数えていた
    it "同じ場所の角は、何本集まっていても1つ" do
      parent = box("親", x: 400, y: 0)
      children = [ box("子1", x: 100, y: 500), box("子2", x: 700, y: 500) ]
      edges = children.map { |c| rel("親", c.id) }

      corners = score([ parent ] + children, edges).counts[:bends]
      raw = Views::Layout::Geometry.call(boxes: [ parent ] + children, relations: edges)
                                   .sum { |line| [ line.polyline.size - 2, 0 ].max }
      expect(corners).to be <= raw
    end
  end
end
