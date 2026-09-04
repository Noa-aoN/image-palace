require "rails_helper"

# 比較図。群れを列にして、行を揃える。
#
# 同じ観点のものが横一列に並ぶので、目を横へ滑らせるだけで違いが読める。
RSpec.describe Views::Layout::Comparison do
  def box(id, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: 0, y: 0, width: width, height: height,
                           footprint_width: width)
  end

  let(:boxes) do
    %w[ギリシャ 建築 文字 ローマ アーチ ラテン エジプト 巨石 象形].map { |id| box(id) }
  end
  let(:groups) do
    [
      { name: "ギリシャ", members: %w[ギリシャ 建築 文字] },
      { name: "ローマ", members: %w[ローマ アーチ ラテン] },
      { name: "エジプト", members: %w[エジプト 巨石 象形] }
    ]
  end

  describe "列にする" do
    it "群れごとに、別の列へ置く" do
      result = described_class.new(boxes: boxes, groups: groups).call
      columns = result.group_by(&:center_x)

      expect(columns.size).to eq(3)
    end

    it "群れの順に、左から並ぶ" do
      result = described_class.new(boxes: boxes, groups: groups).call
      by_id = result.to_h { |b| [ b.id, b ] }

      expect(by_id["ギリシャ"].center_x).to be < by_id["ローマ"].center_x
      expect(by_id["ローマ"].center_x).to be < by_id["エジプト"].center_x
    end
  end

  describe "行を揃える" do
    # 揃わなければ比べられない
    it "各列の同じ順番のカードが、同じ高さに来る" do
      result = described_class.new(boxes: boxes, groups: groups).call
      by_id = result.to_h { |b| [ b.id, b ] }

      expect(by_id["建築"].y).to eq(by_id["アーチ"].y)
      expect(by_id["建築"].y).to eq(by_id["巨石"].y)
    end

    it "高さの違うカードがあっても、行は揃う" do
      tall = boxes.map { |b| b.id == "アーチ" ? box("アーチ", height: 400) : b }
      result = described_class.new(boxes: tall, groups: groups).call
      by_id = result.to_h { |b| [ b.id, b ] }

      expect(by_id["文字"].y).to eq(by_id["ラテン"].y)
      expect(by_id["文字"].y).to be > by_id["アーチ"].y
    end
  end

  describe "群れに入らないもの" do
    it "最後の列にまとめる（消さない）" do
      extra = boxes + [ box("その他") ]
      result = described_class.new(boxes: extra, groups: groups).call

      expect(result.map(&:id)).to include("その他")
      expect(result.map(&:center_x).uniq.size).to eq(4)
    end

    it "同じカードを2つの群れに入れても、1度しか置かない" do
      overlapping = groups + [ { name: "重複", members: %w[建築] } ]
      result = described_class.new(boxes: boxes, groups: overlapping).call

      expect(result.count { |b| b.id == "建築" }).to eq(1)
    end
  end

  describe "比べられないとき" do
    it "群れが1つなら、格子で並べる" do
      one = [ { name: "全部", members: boxes.map(&:id) } ]
      result = described_class.new(boxes: boxes, groups: one).call

      expect(result.map(&:center_x).uniq.size).to be > 1
    end

    it "群れが無くても落ちない" do
      expect { described_class.new(boxes: boxes, groups: []).call }.not_to raise_error
    end
  end
end
