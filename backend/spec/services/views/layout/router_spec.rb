require "rails_helper"

# 線の道すじ。目で見て分かる崩れを、数で確かめる。
RSpec.describe Views::Layout::Router do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(
      id: id, title: id, x: x, y: y, width: width, height: height,
      footprint_width: width
    )
  end

  def route(boxes, from:, to:, source_handle:, target_handle:)
    by_id = boxes.to_h { |b| [ b.id, b ] }
    described_class.new(boxes: by_id).route(by_id[from], by_id[to], source_handle, target_handle)
  end

  # 端点を含めた全部の点。曲がりの数や向きを見るのに使う
  def full_path(boxes, from:, to:, source_handle:, target_handle:)
    by_id = boxes.to_h { |b| [ b.id, b ] }
    points = route(boxes, from: from, to: to, source_handle: source_handle, target_handle: target_handle)
    source = by_id[from]
    target = by_id[to]
    start_point = { "x" => source.center_x, "y" => source.bottom }
    end_point = { "x" => target.center_x, "y" => target.top }
    [ start_point, *points, end_point ]
  end

  def segments(path) = path.each_cons(2).to_a

  describe "折り返さない" do
    # 前の作りは、よけるカードが始点の手前にあると
    # いったん戻ってから進む形になっていた
    it "同じ向きに2回進んだあと、逆へ戻らない" do
      boxes = [
        box("a", x: 0, y: 0),
        box("邪魔", x: 0, y: 400),
        box("b", x: 0, y: 900)
      ]
      path = full_path(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")

      # 縦の進みが、途中で向きを変えない
      vertical = segments(path).map { |p, q| q["y"].to_f - p["y"].to_f }.reject { |d| d.abs < 1 }
      expect(vertical.map { |d| d.positive? }.uniq.size).to eq(1)
    end

    it "横に進むときも折り返さない" do
      boxes = [
        box("a", x: 0, y: 0),
        box("邪魔", x: 400, y: 0),
        box("b", x: 900, y: 0)
      ]
      by_id = boxes.to_h { |b| [ b.id, b ] }
      points = route(boxes, from: "a", to: "b", source_handle: "right", target_handle: "left")
      path = [ { "x" => by_id["a"].right_edge, "y" => by_id["a"].center_y }, *points,
               { "x" => by_id["b"].left_edge, "y" => by_id["b"].center_y } ]

      horizontal = segments(path).map { |p, q| q["x"].to_f - p["x"].to_f }.reject { |d| d.abs < 1 }
      expect(horizontal.map { |d| d.positive? }.uniq.size).to eq(1)
    end
  end

  describe "曲がりは90度まで" do
    it "どの線分も水平か垂直" do
      boxes = [ box("a", x: 0, y: 0), box("邪魔", x: 300, y: 300), box("b", x: 800, y: 800) ]
      path = full_path(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")

      segments(path).each do |p, q|
        dx = (q["x"].to_f - p["x"].to_f).abs
        dy = (q["y"].to_f - p["y"].to_f).abs
        expect(dx < 1 || dy < 1).to be(true), "斜めの線分がある: #{p} → #{q}"
      end
    end

    it "曲がりの数は多くても3回" do
      boxes = [ box("a", x: 0, y: 0), box("邪魔", x: 300, y: 400), box("b", x: 700, y: 900) ]
      points = route(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")

      expect(points.size).to be <= 3
    end
  end

  describe "カードに被らない" do
    it "間にあるカードをよける" do
      boxes = [ box("a", x: 0, y: 0), box("邪魔", x: 0, y: 400), box("b", x: 0, y: 900) ]
      path = full_path(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")
      blocker = boxes.find { |b| b.id == "邪魔" }

      hit = segments(path).any? do |p, q|
        [ 0.25, 0.5, 0.75 ].any? do |t|
          x = p["x"].to_f + (q["x"].to_f - p["x"].to_f) * t
          y = p["y"].to_f + (q["y"].to_f - p["y"].to_f) * t
          x > blocker.left_edge && x < blocker.right_edge && y > blocker.top && y < blocker.bottom
        end
      end
      expect(hit).to be(false)
    end

    it "間に何も無ければ折れ点を作らない" do
      boxes = [ box("a", x: 0, y: 0), box("b", x: 0, y: 900) ]

      expect(route(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")).to eq([])
    end

    # 嘘の迂回を返すより、まっすぐ結ぶほうがまし
    it "どうしても通せないときは、まっすぐ結ぶ" do
      blockers = (0..8).map { |i| box("邪魔#{i}", x: i * 60 - 240, y: 400) }
      boxes = [ box("a", x: 0, y: 0), *blockers, box("b", x: 0, y: 900) ]

      expect { route(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top") }
        .not_to raise_error
    end
  end

  describe "助走" do
    it "カードの縁からまっすぐ離れてから曲がる" do
      boxes = [ box("a", x: 0, y: 0), box("邪魔", x: 0, y: 400), box("b", x: 0, y: 900) ]
      by_id = boxes.to_h { |b| [ b.id, b ] }
      points = route(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")

      # 最初の折れ点は、出た辺と同じ x に乗っている（＝まっすぐ出ている）
      expect(points.first["x"]).to be_within(1).of(by_id["a"].center_x)
    end
  end

  it "同じ入力からは同じ道すじ" do
    boxes = [ box("a", x: 0, y: 0), box("邪魔", x: 0, y: 400), box("b", x: 0, y: 900) ]

    first = route(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")
    second = route(boxes, from: "a", to: "b", source_handle: "bottom", target_handle: "top")

    expect(first).to eq(second)
  end
end

# ここから: まとめて引く（route_all）。
# 1本ずつ引いていた頃は、隣の線がどこを通るかを知らないまま最短路を選んでいた。
RSpec.describe "#{Views::Layout::Router}#route_all" do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height, footprint_width: width)
  end

  # 親1枚と、その下に並ぶ子。家系図でいちばん多い形
  def fan(child_count)
    parent = box("親", x: 600, y: 0)
    children = child_count.times.map { |i| box("子#{i}", x: i * 320, y: 500) }
    by_id = ([ parent ] + children).to_h { |b| [ b.id, b ] }
    links = children.map do |child|
      { from: parent, to: child, source_handle: "bottom", target_handle: "top" }
    end
    [ Views::Layout::Router.new(boxes: by_id).route_all(links), links ]
  end

  describe "同じ辺から出る線を散らす" do
    it "3本の線が、それぞれ違うポートから出る" do
      routes, = fan(3)

      ports = routes.map(&:source_port)
      expect(ports.uniq.size).to eq(3)
    end

    it "ポートはカードの幅に収まる（角からはみ出さない）" do
      routes, = fan(4)

      # 幅144・端の余白14 → 中心から ±58 まで
      expect(routes.map { |r| r.source_port.abs }.max).to be <= 58
    end

    it "相手が左にある線ほど、左のポートから出る（扇の中で交差しない）" do
      routes, links = fan(4)

      by_target_x = links.each_with_index.sort_by { |link, _| link[:to].center_x }
      ports = by_target_x.map { |_, index| routes[index].source_port }
      expect(ports).to eq(ports.sort)
    end

    it "1本だけなら真ん中から出る（散らす理由が無い）" do
      routes, = fan(1)

      expect(routes.first.source_port).to eq(0)
    end
  end

  describe "道すじが重ならない" do
    it "扇の線は、どれも同じ道すじにならない" do
      routes, links = fan(3)

      paths = routes.each_with_index.map do |route, index|
        start = links[index][:from]
        [ [ start.center_x + route.source_port, start.bottom ], *route.points.map { |p| [ p["x"], p["y"] ] } ]
      end
      expect(paths.uniq.size).to eq(3)
    end

    it "同じ2枚を2本で結んでも、線が完全に重ならない" do
      a = box("A", x: 0, y: 0)
      b = box("B", x: 0, y: 500)
      by_id = { "A" => a, "B" => b }
      links = 2.times.map { { from: a, to: b, source_handle: "bottom", target_handle: "top" } }

      routes = Views::Layout::Router.new(boxes: by_id).route_all(links)

      expect(routes[0].source_port).not_to eq(routes[1].source_port)
    end
  end

  describe "ずらしても壊さない" do
    it "助走が裏返らない（端で折り返して見えない）" do
      routes, links = fan(5)

      routes.each_with_index do |route, index|
        next if route.points.empty?

        # 下辺から出た線の最初の点は、必ずカードより下にある
        expect(route.points.first["y"]).to be > links[index][:from].bottom
      end
    end

    it "よけるべきカードを、ずらした線が突っ切らない" do
      parent = box("親", x: 600, y: 0)
      wall = box("壁", x: 560, y: 300)
      children = 3.times.map { |i| box("子#{i}", x: i * 400, y: 700) }
      by_id = ([ parent, wall ] + children).to_h { |b| [ b.id, b ] }
      links = children.map { |c| { from: parent, to: c, source_handle: "bottom", target_handle: "top" } }

      routes = Views::Layout::Router.new(boxes: by_id).route_all(links)

      routes.each_with_index do |route, index|
        path = [
          { "x" => parent.center_x + route.source_port, "y" => parent.bottom },
          *route.points,
          { "x" => children[index].center_x + route.target_port, "y" => children[index].top }
        ]
        crossings = path.each_cons(2).count do |a, b|
          horizontal = (a["y"] - b["y"]).abs < 1
          if horizontal
            a["y"] > wall.top && a["y"] < wall.bottom &&
              [ a["x"], b["x"] ].min < wall.right && [ a["x"], b["x"] ].max > wall.left
          else
            a["x"] > wall.left && a["x"] < wall.right &&
              [ a["y"], b["y"] ].min < wall.bottom && [ a["y"], b["y"] ].max > wall.top
          end
        end
        expect(crossings).to eq(0), "子#{index} の線が壁を突っ切っている"
      end
    end

    it "同じ入力なら同じ結果になる" do
      first, = fan(4)
      second, = fan(4)

      expect(first.map(&:points)).to eq(second.map(&:points))
      expect(first.map(&:source_port)).to eq(second.map(&:source_port))
    end
  end
end

# カードの辺の、どこに線が付くか。
#
# 辺の真ん中に1点だけだった頃は、手で引く線がどれも同じ点から出て、
# つながりが増えるほど根元が束になって読めなくなっていた。
RSpec.describe Views::Layout::Handles do
  def box(id = "a", x: 0, y: 0, width: 200, height: 100)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  describe "辺を読み取る" do
    it "番号付きでも辺が分かる" do
      expect(described_class.side("top-3")).to eq("top")
      expect(described_class.side("left-0")).to eq("left")
    end

    # 昔からのデータはこの形。読めなくならないようにする
    it "番号が無ければ、そのまま辺として読む" do
      expect(described_class.side("bottom")).to eq("bottom")
    end

    it "知らない名前は下辺として扱う（線を失わない）" do
      expect(described_class.side("なにか")).to eq("bottom")
      expect(described_class.side(nil)).to eq("bottom")
    end
  end

  describe "辺のどこか" do
    it "番号が無ければ真ん中" do
      expect(described_class.fraction("top")).to eq(0.5)
    end

    it "真ん中の番号は、番号無しと同じ位置になる" do
      middle = "top-#{described_class::CENTER}"
      expect(described_class.fraction(middle)).to eq(described_class.fraction("top"))
      expect(described_class.name("top", described_class::CENTER)).to eq("top")
    end

    it "端に寄せすぎない（角から線が出ない）" do
      expect(described_class.fraction("top-0")).to be > 0.1
      expect(described_class.fraction("top-#{described_class::POINTS - 1}")).to be < 0.9
    end

    it "範囲の外の番号でも、辺の中に収まる" do
      expect(described_class.fraction("top-99")).to be_between(0.0, 1.0)
    end
  end

  describe "線が出入りする点" do
    it "上辺の点は、辺の上に乗る" do
      point = described_class.point(box, "top-0")

      expect(point[:y]).to eq(0)
      expect(point[:x]).to be_between(0, 200)
    end

    it "番号が大きいほど、右（下）へ寄る" do
      left = described_class.point(box, "top-0")[:x]
      right = described_class.point(box, "top-#{described_class::POINTS - 1}")[:x]

      expect(right).to be > left
    end

    it "左右の辺では、縦に散る" do
      top = described_class.point(box, "right-0")[:y]
      bottom = described_class.point(box, "right-#{described_class::POINTS - 1}")[:y]

      expect(bottom).to be > top
      expect(described_class.point(box, "right-0")[:x]).to eq(200)
    end

    # AI が配るずれと、手で選んだ点は、重ねて効く
    it "ポートのずれは、選んだ点からの差になる" do
      base = described_class.point(box, "top-1")[:x]

      expect(described_class.point(box, "top-1", 30)[:x]).to eq(base + 30)
    end
  end

  describe "線を引くときに使う" do
    it "選んだ点から線が出る" do
      a = box("a", x: 0, y: 0)
      b = box("b", x: 0, y: 500)
      by_id = { "a" => a, "b" => b }
      links = [ { from: a, to: b, source_handle: "bottom-0", target_handle: "top-2" } ]

      routes = Views::Layout::Router.new(boxes: by_id).route_all(links)
      first = routes.first.points.first

      # 下辺の左寄りから出るので、カードの中心より左から降りる
      expect(first["x"]).to be < a.center_x
      expect(first["y"]).to be > a.bottom
    end
  end
end

# 助走はカードの縁に線が張り付かないようにするもの。
# **接合点のような「点」には要らない。**
RSpec.describe "#{Views::Layout::Router} 小さい相手からの助走" do
  def box(id, width:, height:)
    Views::Layout::Box.new(id: id, title: id, x: 0, y: 0, width: width, height: height,
                           footprint_width: width)
  end

  def router = Views::Layout::Router.new(boxes: {})

  it "カードからは、これまでどおり離れる" do
    card = box("カード", width: 144, height: 176)

    expect(router.send(:stub_for, card)).to eq(Views::Layout::Router::STUB)
  end

  # 28px も取ると、元の線から離れて生えたように見える
  it "接合点からは、短く離れる" do
    junction = box("接合点", width: 14, height: 14)

    expect(router.send(:stub_for, junction)).to eq(Views::Layout::Router::JUNCTION_STUB)
    expect(router.send(:stub_for, junction)).to be < Views::Layout::Router::STUB
  end

  it "相手が分からないときは、これまでどおり" do
    expect(router.send(:stub_for, nil)).to eq(Views::Layout::Router::STUB)
  end

  it "助走の先は、その長さだけ離れる" do
    junction = box("接合点", width: 14, height: 14)
    point = { x: 100, y: 100 }

    out = router.send(:step_out, point, "bottom", junction)
    expect(out[:y] - point[:y]).to eq(Views::Layout::Router::JUNCTION_STUB)
  end
end
