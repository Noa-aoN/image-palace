require "rails_helper"

# 構造から配置を作る。ここが「AI に座標を出させる」の代わり。
RSpec.describe Views::Layout::Planner do
  def box(id, title: id, x: 0, y: 0)
    Views::Layout::Box.new(
      id: id, title: title, x: x, y: y, width: 144, height: 176,
      footprint_width: Views::Layout::Metrics.title_footprint_width(title)
    )
  end

  def rel(from, to) = { from: from, to: to }

  def overlaps(boxes)
    Views::Layout::Score.new(boxes: boxes, edges: []).overlaps
  end

  describe "重なり" do
    it "どの形で組んでも、重なりは残さない" do
      %w[hierarchy flow radial cluster grid].each do |structure|
        boxes = (1..12).map { |i| box("c#{i}") }
        described_class.new(boxes: boxes, relations: (2..12).map { |i| rel("c1", "c#{i}") },
                            structure: structure).call

        expect(overlaps(boxes)).to eq(0), "#{structure} で重なった"
      end
    end

    # 盤が固定だった頃は、33枚目から押しのけが収束せず、重なったまま黙って終わっていた
    it "50枚でも重ならない（盤を広げる）" do
      boxes = (1..50).map { |i| box("c#{i}") }
      described_class.new(boxes: boxes, relations: [], structure: "grid").call

      expect(overlaps(boxes)).to eq(0)
    end

    it "200枚でも重ならない" do
      boxes = (1..200).map { |i| box("c#{i}") }
      described_class.new(boxes: boxes, relations: [], structure: "grid").call

      expect(overlaps(boxes)).to eq(0)
    end
  end

  describe "盤からはみ出さない" do
    it "左と上に余白を残す" do
      boxes = (1..20).map { |i| box("c#{i}") }
      described_class.new(boxes: boxes, relations: [], structure: "grid").call

      expect(boxes.map(&:left).min).to be >= Views::Layout::Metrics::BOARD_PADDING - 1
      expect(boxes.map(&:top).min).to be >= Views::Layout::Metrics::BOARD_PADDING - 1
    end
  end

  describe "同じ入力からは同じ図" do
    it "2回組んで座標が一致する" do
      relations = [ rel("a", "b"), rel("a", "c"), rel("b", "d") ]
      first = %w[a b c d].map { |id| box(id) }
      second = %w[a b c d].map { |id| box(id) }

      described_class.new(boxes: first, relations: relations).call
      described_class.new(boxes: second, relations: relations).call

      expect(first.map(&:to_placement)).to eq(second.map(&:to_placement))
    end
  end

  describe "おまかせ" do
    it "線が無ければ、関係で並べようとしない" do
      boxes = (1..6).map { |i| box("c#{i}") }
      result = described_class.new(boxes: boxes, relations: []).call

      expect(%w[cluster grid]).to include(result.structure)
    end

    it "木の形をしていれば階層か放射を選ぶ" do
      boxes = %w[根 a b c].map { |id| box(id) }
      result = described_class.new(
        boxes: boxes, relations: [ rel("根", "a"), rel("根", "b"), rel("根", "c") ]
      ).call

      expect(%w[hierarchy radial]).to include(result.structure)
    end
  end

  describe "いまの形を活かす" do
    it "重なっていなければ動かさない" do
      boxes = [ box("a", x: 300, y: 300), box("b", x: 900, y: 300) ]
      described_class.new(boxes: boxes, structure: "keep_shape").call

      expect(boxes.map(&:to_placement)).to eq(
        [ { id: "a", x: 300, y: 300, width: 144, height: 176 },
          { id: "b", x: 900, y: 300, width: 144, height: 176 } ]
      )
    end

    it "重なっているところだけ離す" do
      boxes = [ box("a", x: 300, y: 300), box("b", x: 310, y: 300) ]
      described_class.new(boxes: boxes, structure: "keep_shape").call

      expect(overlaps(boxes)).to eq(0)
    end
  end

  describe "群れ" do
    it "同じ群れは近く、別の群れとは離れる" do
      boxes = %w[a1 a2 b1 b2].map { |id| box(id) }
      described_class.new(
        boxes: boxes, structure: "cluster",
        groups: [ { members: %w[a1 a2] }, { members: %w[b1 b2] } ]
      ).call
      at = boxes.to_h { |b| [ b.id, b ] }

      within = (at["a1"].center_x - at["a2"].center_x).abs + (at["a1"].center_y - at["a2"].center_y).abs
      between = (at["a1"].center_x - at["b1"].center_x).abs + (at["a1"].center_y - at["b1"].center_y).abs
      expect(between).to be > within
    end

    it "どの群れにも入らなかったカードも置く（消さない）" do
      boxes = %w[a1 a2 余].map { |id| box(id) }
      described_class.new(boxes: boxes, structure: "cluster",
                          groups: [ { members: %w[a1 a2] } ]).call

      expect(boxes.map(&:id)).to include("余")
    end
  end

  describe "壊れた入力" do
    it "カードが無ければ何もしない" do
      result = described_class.new(boxes: [], relations: [ rel("a", "b") ]).call

      expect(result.boxes).to eq([])
    end

    it "知らない構造の名前は、おまかせに落とす" do
      boxes = [ box("a") ]

      expect { described_class.new(boxes: boxes, structure: "unknown").call }.not_to raise_error
    end

    it "居ないカードへの線は無視する" do
      boxes = [ box("a") ]

      expect { described_class.new(boxes: boxes, relations: [ rel("a", "居ない") ]).call }
        .not_to raise_error
    end
  end

  describe "採点" do
    it "重なりと交差を数える" do
      boxes = %w[a b c d].map { |id| box(id) }
      result = described_class.new(
        boxes: boxes, relations: [ rel("a", "b"), rel("c", "d") ]
      ).call

      expect(result.score.overlaps).to eq(0)
      expect(result.score.to_h).to include(:points, :breakdown, :counts, :ratios)
      expect(result.score.points).to be_between(0, 100)
    end

    it "重なりが残ったら、そう伝える" do
      boxes = [ box("a", x: 300, y: 300), box("b", x: 305, y: 300) ]
      score = Views::Layout::Score.new(boxes: boxes, edges: [])

      expect(score.overlaps).to eq(1)
      expect(score.notes.first).to include("重なっています")
    end
  end
  # 向きは種別とは別の軸。同じ階層図を縦にも横にもできる
  describe "流れの向き" do
    def tree
      %w[根 a b].map { |id| box(id) }
    end

    def edges = [ rel("根", "a"), rel("根", "b") ]

    it "指定が無ければ、階層図は上から下" do
      boxes = tree
      described_class.new(boxes: boxes, relations: edges, structure: "hierarchy").call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["a"].y).to be > at["根"].y
      expect(at["a"].y).to be_within(1).of(at["b"].y)
    end

    it "指定が無ければ、流れ図は左から右" do
      boxes = tree
      described_class.new(boxes: boxes, relations: edges, structure: "flow").call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["a"].x).to be > at["根"].x
    end

    it "階層図でも、左から右にできる" do
      boxes = tree
      described_class.new(boxes: boxes, relations: edges, structure: "hierarchy",
                          direction: "right").call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["a"].x).to be > at["根"].x
      expect(at["a"].x).to be_within(1).of(at["b"].x)
    end

    it "流れ図でも、上から下にできる" do
      boxes = tree
      described_class.new(boxes: boxes, relations: edges, structure: "flow",
                          direction: "down").call
      at = boxes.to_h { |b| [ b.id, b ] }

      expect(at["a"].y).to be > at["根"].y
    end

    it "マインドマップは、上下へ振り分けにもできる" do
      boxes = %w[中心 a b c d].map { |id| box(id) }
      relations = %w[a b c d].map { |x| rel("中心", x) }
      described_class.new(boxes: boxes, relations: relations, structure: "mindmap",
                          direction: "down").call
      at = boxes.to_h { |b| [ b.id, b ] }
      center = at["中心"].center_y

      above = %w[a b c d].count { |x| at[x].center_y < center }
      below = %w[a b c d].count { |x| at[x].center_y > center }
      expect(above).to be_positive
      expect(below).to be_positive
    end

    it "知らない向きは、おまかせに落とす" do
      boxes = tree

      expect { described_class.new(boxes: boxes, relations: edges, direction: "斜め").call }
        .not_to raise_error
    end
  end
end
