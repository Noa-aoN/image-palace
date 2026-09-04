require "rails_helper"

# 近いものを、揃える。
#
# 段に並べる仕組みは段どうしの縦の通りを見ていないので、
# 「揃えるつもりだったものが35pxだけずれる」ということが起きる。
RSpec.describe Views::Layout::Align do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  describe "揃える" do
    it "少しだけずれているものを、同じ位置へ寄せる" do
      boxes = [ box("親", x: 700, y: 0), box("子", x: 665, y: 400) ]

      described_class.new(boxes: boxes).call

      expect(boxes[0].center_x).to eq(boxes[1].center_x)
    end

    it "3枚でも揃う" do
      boxes = [ box("a", x: 700, y: 0), box("b", x: 680, y: 400), box("c", x: 715, y: 800) ]

      described_class.new(boxes: boxes).call

      expect(boxes.map(&:center_x).uniq.size).to eq(1)
    end
  end

  describe "揃えないとき" do
    # 同じ高さで同じ横位置にしたら重なる
    it "同じ段のものは揃えない" do
      boxes = [ box("a", x: 700, y: 0), box("b", x: 665, y: 0) ]
      before = boxes.map(&:center_x)

      described_class.new(boxes: boxes).call

      expect(boxes.map(&:center_x)).to eq(before)
    end

    # 遠いものまで引き寄せると、並びを作り直したことになる
    it "離れているものは揃えない" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 900, y: 400) ]
      before = boxes.map(&:center_x)

      described_class.new(boxes: boxes).call

      expect(boxes.map(&:center_x)).to eq(before)
    end

    it "動かす幅には上限がある" do
      # 組の平均から遠いものは置いていく
      boxes = [ box("a", x: 700, y: 0), box("b", x: 700, y: 400), box("c", x: 755, y: 800) ]

      described_class.new(boxes: boxes).call

      expect(boxes[0].center_x).to eq(boxes[1].center_x)
    end

    it "1枚なら何もしない" do
      boxes = [ box("a", x: 700, y: 0) ]

      expect { described_class.new(boxes: boxes).call }.not_to raise_error
    end
  end

  describe "同じ入力なら同じ結果" do
    it "2回揃えても同じ位置になる" do
      make = -> { [ box("a", x: 700, y: 0), box("b", x: 665, y: 400), box("c", x: 690, y: 800) ] }
      first = make.call.tap { |list| described_class.new(boxes: list).call }.map(&:center_x)
      second = make.call.tap { |list| described_class.new(boxes: list).call }.map(&:center_x)

      expect(first).to eq(second)
    end
  end
end
