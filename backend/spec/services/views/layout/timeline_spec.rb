require "rails_helper"

# 時系列図。**時間の軸が1本**あり、出来事がその上に並ぶ。
RSpec.describe Views::Layout::Timeline do
  def box(id, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: 0, y: 0, width: width, height: height,
                           footprint_width: width)
  end

  def seq(from, to) = { from: from, to: to, type: "sequence" }

  let(:events) { %w[建国 帝政 分裂 滅亡].map { |id| box(id) } }
  let(:chain) { [ seq("建国", "帝政"), seq("帝政", "分裂"), seq("分裂", "滅亡") ] }

  describe "軸に並べる" do
    it "順番どおりに、左から右へ置く" do
      result = described_class.new(boxes: events, edges: chain).call
      order = result.sort_by(&:x).map(&:id)

      expect(order).to eq(%w[建国 帝政 分裂 滅亡])
    end

    it "軸のカードは、同じ高さに並ぶ" do
      result = described_class.new(boxes: events, edges: chain).call

      expect(result.map(&:y).uniq.size).to eq(1)
    end

    it "重ならない" do
      result = described_class.new(boxes: events, edges: chain).call
      sorted = result.sort_by(&:x)

      sorted.each_cons(2) { |a, b| expect(b.x).to be >= a.x + a.footprint_width }
    end
  end

  describe "軸から外れるもの" do
    it "繋がっている相手の真下へ置く" do
      boxes = events + [ box("補足") ]
      result = described_class.new(boxes: boxes, edges: chain + [ seq("帝政", "補足") ]).call

      note = result.find { |b| b.id == "補足" }
      empire = result.find { |b| b.id == "帝政" }
      expect(note.center_x).to eq(empire.center_x)
      expect(note.y).to be > empire.y
    end

    it "どこにも繋がらないカードも、消さずに置く" do
      boxes = events + [ box("孤島") ]
      result = described_class.new(boxes: boxes, edges: chain).call

      expect(result.map(&:id)).to include("孤島")
      expect(result.find { |b| b.id == "孤島" }.y).to be > result.find { |b| b.id == "建国" }.y
    end
  end

  describe "壊れた入力" do
    it "輪になっていても止まる" do
      loops = chain + [ seq("滅亡", "建国") ]

      expect { described_class.new(boxes: events, edges: loops).call }.not_to raise_error
    end

    it "同列の関係は時間を進めない（兄弟は同じ時点）" do
      boxes = [ box("A"), box("B") ]
      result = described_class.new(boxes: boxes, edges: [ { from: "A", to: "B", type: "peer" } ]).call

      # 鎖にならないので、両方が軸か下に置かれる。**重ならないことが要点**
      expect(result.map { |b| [ b.x, b.y ] }.uniq.size).to eq(2)
    end

    it "線が1本も無くても落ちない" do
      expect { described_class.new(boxes: events, edges: []).call }.not_to raise_error
    end

    it "同じ入力なら同じ結果になる" do
      first = described_class.new(boxes: events.map { |b| b.dup_at(0, 0) }, edges: chain).call
      second = described_class.new(boxes: events.map { |b| b.dup_at(0, 0) }, edges: chain).call

      expect(first.map { |b| [ b.id, b.x, b.y ] }).to eq(second.map { |b| [ b.id, b.x, b.y ] })
    end
  end
end
