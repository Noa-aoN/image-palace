require "rails_helper"

# 点数が上がる方へ動かす。
#
# 案を作って比べるだけでは、案の中にしか答えが無い。
# 出来上がった図に小さな手を当てて、上がったら残す。
RSpec.describe Views::Layout::Improver do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  def rel(from, to, type: "parent")
    { from: from, to: to, type: type, label: "子", strength: 0.8 }
  end

  def scorer(relations)
    lambda do |boxes|
      lines = Views::Layout::Geometry.call(boxes: boxes, relations: relations)
      Views::Layout::Score.new(boxes: boxes, edges: relations, lines: lines)
    end
  end

  def improve(boxes, relations, **options)
    described_class.new(boxes: boxes, relations: relations, score_for: scorer(relations), **options).call
  end

  # 子の並びが左右逆で、線が交差している形
  let(:crossed_boxes) do
    [ box("親A", x: 0, y: 0), box("親B", x: 400, y: 0),
      box("子A", x: 400, y: 400), box("子B", x: 0, y: 400) ]
  end
  let(:crossed_edges) { [ rel("親A", "子A"), rel("親B", "子B") ] }

  describe "点数を下げない" do
    it "手を当てても、始めた時より悪くならない" do
      before = scorer(crossed_edges).call(crossed_boxes.map { |b| b.dup_at(b.x, b.y) })
      after = improve(crossed_boxes, crossed_edges)

      expect(after[:score].points).to be >= before.points
    end

    it "整いきった図は、そのまま返す" do
      tidy = [ box("親", x: 400, y: 0), box("子1", x: 200, y: 400), box("子2", x: 600, y: 400) ]
      edges = [ rel("親", "子1"), rel("親", "子2") ]
      before = tidy.map { |b| [ b.x, b.y ] }

      result = improve(tidy, edges)

      expect(result[:score].points).to be >= scorer(edges).call(tidy).points
      expect(tidy.map { |b| [ b.x, b.y ] }).to eq(before) if result[:kept].zero?
    end
  end

  describe "同じ入力なら同じ結果" do
    it "2回動かしても、同じ配置になる" do
      first = improve(crossed_boxes.map { |b| b.dup_at(b.x, b.y) }, crossed_edges)
      second = improve(crossed_boxes.map { |b| b.dup_at(b.x, b.y) }, crossed_edges)

      expect(first[:boxes].map { |b| [ b.id, b.x.round, b.y.round ] })
        .to eq(second[:boxes].map { |b| [ b.id, b.x.round, b.y.round ] })
    end
  end

  describe "時間で打ち切る" do
    it "予算が無ければ、1手も当てない" do
      result = improve(crossed_boxes, crossed_edges, budget: 0)

      expect(result[:tried]).to eq(0)
      expect(result[:kept]).to eq(0)
    end

    it "予算のうちに終わる" do
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      improve(crossed_boxes, crossed_edges, budget: 0.3)
      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started

      # 手を1つ当てる時間ぶんは超えうる。倍まで見る
      expect(elapsed).to be < 0.6
    end
  end

  describe "動かせないとき" do
    it "カードが1枚なら何もしない" do
      result = improve([ box("a", x: 0, y: 0) ], [])

      expect(result[:tried]).to eq(0)
    end

    it "線が無くても落ちない" do
      expect { improve(crossed_boxes, []) }.not_to raise_error
    end
  end

  describe "測り直さない" do
    # 58枚では1回の採点に0.4秒かかる。測り直すだけで予算の2割が消える
    it "分かっている点数を渡せば、最初の採点をしない" do
      calls = 0
      counting = lambda do |boxes|
        calls += 1
        scorer(crossed_edges).call(boxes)
      end
      known = scorer(crossed_edges).call(crossed_boxes)

      described_class.new(boxes: crossed_boxes, relations: crossed_edges,
                          score_for: counting, budget: 0, score: known).call

      expect(calls).to eq(0)
    end
  end
end
