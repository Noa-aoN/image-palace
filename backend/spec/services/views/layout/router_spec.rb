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
