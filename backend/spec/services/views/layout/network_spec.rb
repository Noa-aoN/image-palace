require "rails_helper"

# 関係図・相関図。上下の関係が無い、網の目のつながり。
# 階層で置けないのは「親がひとつ」を前提にできないため。
RSpec.describe Views::Layout::Network do
  def box(id)
    Views::Layout::Box.new(
      id: id, title: id, x: 0, y: 0, width: 144, height: 176,
      footprint_width: Views::Layout::Metrics.title_footprint_width(id)
    )
  end

  def rel(from, to, strength: 0.5) = { from: from, to: to, strength: strength }

  def place(ids, edges)
    boxes = ids.map { |id| box(id) }
    described_class.new(boxes: boxes, edges: edges).call
    boxes.to_h { |b| [ b.id, b ] }
  end

  def distance(a, b) = Math.hypot(a.center_x - b.center_x, a.center_y - b.center_y)

  describe "引き合う力" do
    it "つながっているものは、つながっていないものより近い" do
      at = place(%w[a b c d e], [ rel("a", "b"), rel("c", "d"), rel("d", "e") ])

      expect(distance(at["a"], at["b"])).to be < distance(at["a"], at["c"])
    end

    it "強い関係ほど近くなる" do
      at = place(%w[中心 強 弱 他1 他2],
                 [ rel("中心", "強", strength: 1.0), rel("中心", "弱", strength: 0.1),
                   rel("他1", "他2") ])

      expect(distance(at["中心"], at["強"])).to be < distance(at["中心"], at["弱"])
    end
  end

  describe "押し合う力" do
    it "重ならない" do
      at = place((1..15).map { |i| "c#{i}" }, (2..15).map { |i| rel("c1", "c#{i}") })

      expect(Views::Layout::Score.new(boxes: at.values, edges: []).overlaps).to eq(0)
    end

    it "全部が同じ場所から始まっても散らばる" do
      at = place(%w[a b c d], [ rel("a", "b"), rel("b", "c"), rel("c", "d") ])

      expect(at.values.map { |b| [ b.x.round, b.y.round ] }.uniq.size).to eq(4)
    end
  end

  # この種の配置はふつう乱数を使うので、呼ぶたびに違う図になる
  it "同じ入力からは同じ図（乱数を使わない）" do
    edges = [ rel("a", "b"), rel("b", "c"), rel("c", "a"), rel("c", "d") ]
    first = place(%w[a b c d], edges)
    second = place(%w[a b c d], edges)

    expect(first.values.map(&:to_placement)).to eq(second.values.map(&:to_placement))
  end

  describe "壊れた入力" do
    it "線が無ければ並べるだけにする" do
      at = place(%w[a b c], [])

      expect(Views::Layout::Score.new(boxes: at.values, edges: []).overlaps).to eq(0)
    end

    it "カードが2枚以下でも落ちない" do
      expect { place(%w[a b], [ rel("a", "b") ]) }.not_to raise_error
    end

    it "知らない id の線は無視する" do
      expect { place(%w[a], [ rel("a", "居ない") ]) }.not_to raise_error
    end
  end

  it "盤の左と上に余白を残す" do
    at = place(%w[a b c d], [ rel("a", "b"), rel("c", "d") ])

    expect(at.values.map(&:left).min).to be >= Views::Layout::Metrics::BOARD_PADDING - 1
    expect(at.values.map(&:top).min).to be >= Views::Layout::Metrics::BOARD_PADDING - 1
  end
end
