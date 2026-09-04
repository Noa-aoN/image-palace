require "rails_helper"

# 線の上の文字。**どちらの線の文字なのか読めること**を確かめる。
RSpec.describe Views::Layout::LabelPlacement do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height, footprint_width: width)
  end

  # 同じ2枚を2本で結ぶ。道すじがいちばん重なりやすい形
  def twin(labels)
    a = box("A", x: 0, y: 0)
    b = box("B", x: 0, y: 500)
    links = labels.size.times.map { { from: a, to: b, source_handle: "bottom", target_handle: "top" } }
    routes = Views::Layout::Router.new(boxes: { "A" => a, "B" => b }).route_all(links)
    [ described_class.call(routes:, labels:, links:), routes, links ]
  end

  # 文字が実際に占める面。**点ではなく矩形で見る**（文字には高さと幅がある）
  def spot_rects(spots, routes, links, labels)
    placement = described_class.new(routes:, labels:, links:)
    spots.each_with_index.map do |spot, index|
      polyline = placement.send(:polyline_for, index)
      placement.send(:rect_at, polyline, spot || 0.5, labels[index].to_s,
                     described_class::DEFAULT_FONT_SIZE)
    end
  end

  def overlapping?(a, b)
    [ a[:right], b[:right] ].min > [ a[:left], b[:left] ].max &&
      [ a[:bottom], b[:bottom] ].min > [ a[:top], b[:top] ].max
  end

  describe "重なった文字をずらす" do
    it "同じ2枚を結ぶ2本の文字が、重ならない" do
      labels = [ "姉妹", "娘" ]
      spots, routes, links = twin(labels)
      rects = spot_rects(spots, routes, links, labels)

      expect(overlapping?(rects[0], rects[1])).to be(false)
    end

    # 点の間隔だけを見ていた頃は、長い語が横へ伸びて隣に被っていた
    it "長い語どうしでも重ならない" do
      labels = [ "オリュンポスの神々", "ティタン神族" ]
      spots, routes, links = twin(labels)
      rects = spot_rects(spots, routes, links, labels)

      expect(overlapping?(rects[0], rects[1])).to be(false)
    end

    it "文字は線の上に乗ったまま（線から浮かない）" do
      spots, = twin([ "姉妹", "娘" ])

      expect(spots).to all(be_between(0.0, 1.0))
    end

    it "1本だけなら真ん中に置く（ずらす理由が無い）" do
      spots, = twin([ "父" ])

      expect(spots).to eq([ described_class::CENTER ])
    end
  end

  describe "文字が無い線" do
    it "空の label には場所を決めない" do
      spots, = twin([ "父", "", nil ])

      expect(spots[1]).to be_nil
      expect(spots[2]).to be_nil
    end

    it "文字の無い線は、他の文字を押しのけない" do
      spots, = twin([ nil, "父" ])

      expect(spots[1]).to eq(described_class::CENTER)
    end
  end

  describe "扇のとき" do
    it "親から5人の子への文字が、どれも重ならない" do
      parent = box("親", x: 600, y: 0)
      children = 5.times.map { |i| box("子#{i}", x: i * 240, y: 500) }
      links = children.map { |c| { from: parent, to: c, source_handle: "bottom", target_handle: "top" } }
      by_id = ([ parent ] + children).to_h { |b| [ b.id, b ] }
      routes = Views::Layout::Router.new(boxes: by_id).route_all(links)
      labels = %w[長男 次男 三男 長女 次女]

      spots = described_class.call(routes:, labels:, links:)
      rects = spot_rects(spots, routes, links, labels)

      expect(rects.combination(2).none? { |a, b| overlapping?(a, b) }).to be(true)
    end
  end
end

# 文字は面を持つ。点だけで見ていた頃に見落としていたこと。
RSpec.describe "#{Views::Layout::LabelPlacement} 面としての文字" do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height, footprint_width: width)
  end

  def place(labels, links, boxes, font_sizes: nil)
    by_id = boxes.to_h { |b| [ b.id, b ] }
    routes = Views::Layout::Router.new(boxes: by_id).route_all(links)
    spots = Views::Layout::LabelPlacement.call(routes:, labels:, links:, font_sizes:, boxes:)
    placement = Views::Layout::LabelPlacement.new(routes:, labels:, links:, font_sizes:, boxes:)
    rects = spots.each_with_index.map do |spot, index|
      next nil if spot.nil?

      placement.send(:rect_at, placement.send(:polyline_for, index), spot,
                     labels[index], placement.send(:font_size, index))
    end
    [ spots, rects, placement ]
  end

  describe "文字の大きさを加味する" do
    it "大きい文字ほど広く場所を取る" do
      a = box("A", x: 0, y: 0)
      b = box("B", x: 0, y: 500)
      links = [ { from: a, to: b, source_handle: "bottom", target_handle: "top" } ]

      _, small = place([ "父" ], links, [ a, b ], font_sizes: [ 13 ])
      _, large = place([ "父" ], links, [ a, b ], font_sizes: [ 28 ])

      expect(large[0][:right] - large[0][:left]).to be > (small[0][:right] - small[0][:left])
      expect(large[0][:bottom] - large[0][:top]).to be > (small[0][:bottom] - small[0][:top])
    end

    it "大きくした文字どうしでも重ならない" do
      a = box("A", x: 0, y: 0)
      b = box("B", x: 0, y: 500)
      links = 2.times.map { { from: a, to: b, source_handle: "bottom", target_handle: "top" } }

      spots, rects = place([ "姉妹", "娘" ], links, [ a, b ], font_sizes: [ 24, 24 ])

      expect(spots.uniq.size).to eq(2)
      overlap = [ rects[0][:right], rects[1][:right] ].min > [ rects[0][:left], rects[1][:left] ].max &&
                [ rects[0][:bottom], rects[1][:bottom] ].min > [ rects[0][:top], rects[1][:top] ].max
      expect(overlap).to be(false)
    end
  end

  describe "他の線を隠さない" do
    # 親から3人の子。真ん中の子への線は、両隣の文字の通り道でもある
    it "文字が、別の線の上にできるだけ乗らない" do
      parent = box("親", x: 600, y: 0)
      children = 3.times.map { |i| box("子#{i}", x: i * 200, y: 420) }
      links = children.map { |c| { from: parent, to: c, source_handle: "bottom", target_handle: "top" } }
      labels = %w[長男 次男 三男]

      spots, rects, placement = place(labels, links, [ parent ] + children)

      # 自分以外の線を横切っている長さの合計。0 が理想、多少は許す
      crossed = rects.each_with_index.sum do |rect, index|
        placement.send(:edge_crossing_length, rect, index)
      end
      expect(crossed).to be < 40
      expect(spots).to all(be_between(0.0, 1.0))
    end
  end

  describe "カードの上に乗らない" do
    # ずらすこと自体が、新しい問題を作らないようにする。
    # 端へ寄せた文字が、そのカードの見出しの上に乗ったら意味がない
    it "前後へずらしても、カードの上には乗せない" do
      a = box("A", x: 0, y: 0)
      b = box("B", x: 0, y: 320)
      links = 2.times.map { { from: a, to: b, source_handle: "bottom", target_handle: "top" } }
      labels = [ "とても長い関係の名前", "こちらも長い関係の名前" ]

      spots, rects, placement = place(labels, links, [ a, b ])

      expect(spots.compact.size).to eq(2)
      rects.each { |rect| expect(placement.send(:card_overlap, rect)).to eq(0) }
    end

    it "近くの別のカードも避ける（線の両端だけを見ない）" do
      a = box("A", x: 0, y: 0)
      b = box("B", x: 0, y: 900)
      links = [ { from: a, to: b, source_handle: "bottom", target_handle: "top" } ]
      # 線からは離れているが、真ん中に置いた文字は掠める場所
      neighbour = box("隣", x: 100, y: 500, width: 200, height: 80)

      _, rects, placement = place([ "つながり" ], links, [ a, b, neighbour ])
      wide = place([ "つながり" ], links, [ a, b ]).last

      # 隣を知っていれば、掠らない場所を選ぶ
      expect(placement.send(:card_overlap, rects[0])).to eq(0)
      expect(wide).to be_present
    end
  end
end
