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

  # 文字が実際に置かれる場所。画面が描くのと同じ形の上で測る
  def spot_points(spots, routes, links)
    placement = described_class.new(routes:, labels: spots.map { "x" }, links:)
    spots.each_with_index.map do |spot, index|
      polyline = placement.send(:polyline_for, index)
      placement.send(:point_at, polyline, spot || 0.5)
    end
  end

  describe "重なった文字をずらす" do
    it "同じ2枚を結ぶ2本の文字が、離れた場所に出る" do
      spots, routes, links = twin([ "姉妹", "娘" ])
      points = spot_points(spots, routes, links)

      distance = Math.hypot(points[0][:x] - points[1][:x], points[0][:y] - points[1][:y])
      expect(distance).to be >= described_class::MIN_DISTANCE
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
      points = spot_points(spots, routes, links)

      pairs = points.combination(2).map { |a, b| Math.hypot(a[:x] - b[:x], a[:y] - b[:y]) }
      expect(pairs.min).to be >= described_class::MIN_DISTANCE
    end
  end
end
