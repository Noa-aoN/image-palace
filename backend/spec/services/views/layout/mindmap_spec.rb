require "rails_helper"

# マインドマップは、放射とは開く向きが違う。
# 360度へ均等に広げるのではなく、**左右へ振り分ける**のが手で書くときの形。
RSpec.describe Views::Layout::Mindmap do
  def box(id, title: id)
    Views::Layout::Box.new(
      id: id, title: title, x: 0, y: 0, width: 144, height: 176,
      footprint_width: Views::Layout::Metrics.title_footprint_width(title)
    )
  end

  def rel(from, to) = { from: from, to: to }

  def place(ids, edges, roots: [])
    boxes = ids.map { |id| box(id) }
    described_class.new(boxes: boxes, edges: edges, roots: roots).call
    boxes.to_h { |b| [ b.id, b ] }
  end

  describe "左右への振り分け" do
    it "大枝が両側に分かれる" do
      at = place(%w[中心 a b c d], %w[a b c d].map { |x| rel("中心", x) })
      center = at["中心"].center_x

      left = %w[a b c d].count { |x| at[x].center_x < center }
      right = %w[a b c d].count { |x| at[x].center_x > center }
      expect(left).to be_positive
      expect(right).to be_positive
    end

    it "枝が1つでも置ける" do
      at = place(%w[中心 a], [ rel("中心", "a") ])

      expect(at["a"].center_x).not_to eq(at["中心"].center_x)
    end

    # 数で半分ずつにすると、子を多く持つ枝が集まった側だけ縦に長くなる
    it "ぶら下げる数で釣り合いを取る" do
      edges = [ rel("中心", "重"), rel("中心", "軽1"), rel("中心", "軽2") ] +
              (1..6).map { |i| rel("重", "孫#{i}") }
      at = place(%w[中心 重 軽1 軽2] + (1..6).map { |i| "孫#{i}" }, edges)
      center = at["中心"].center_x

      heavy_side = at["重"].center_x > center ? 1 : -1
      light_side = %w[軽1 軽2].map { |x| at[x].center_x > center ? 1 : -1 }
      # 重い枝と軽い枝は反対側へ回る
      expect(light_side).to all(eq(-heavy_side))
    end
  end

  describe "小枝は同じ側へ伸びる" do
    it "左の枝の子は、さらに左へ" do
      at = place(%w[中心 a b 子], [ rel("中心", "a"), rel("中心", "b"), rel("a", "子") ])
      center = at["中心"].center_x

      side = at["a"].center_x > center ? 1 : -1
      expect((at["子"].center_x - center) * side).to be > (at["a"].center_x - center) * side
    end

    it "深くなるほど中心から遠ざかる" do
      at = place(%w[中心 a b c], [ rel("中心", "a"), rel("a", "b"), rel("b", "c") ])
      center = at["中心"].center_x

      distances = %w[a b c].map { |x| (at[x].center_x - center).abs }
      expect(distances).to eq(distances.sort)
    end
  end

  describe "壊れた入力" do
    it "線が無ければ並べるだけにする" do
      boxes = %w[a b c].map { |id| box(id) }

      expect { described_class.new(boxes: boxes, edges: []).call }.not_to raise_error
    end

    it "つながりの無いカードも置く（消さない）" do
      at = place(%w[中心 a 孤], [ rel("中心", "a") ])

      expect(at["孤"]).to be_present
    end

    it "輪になっていても落ちない" do
      boxes = %w[a b c].map { |id| box(id) }

      expect {
        described_class.new(boxes: boxes, edges: [ rel("a", "b"), rel("b", "c"), rel("c", "a") ]).call
      }.not_to raise_error
    end
  end

  it "同じ入力からは同じ図" do
    edges = [ rel("中心", "a"), rel("中心", "b"), rel("a", "子") ]
    first = place(%w[中心 a b 子], edges)
    second = place(%w[中心 a b 子], edges)

    expect(first.values.map(&:to_placement)).to eq(second.values.map(&:to_placement))
  end
end
