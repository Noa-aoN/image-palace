# frozen_string_literal: true

module Views
  module Layout
    # 線の道すじを引く。
    #
    # ## 前の作りの3つの問題
    #
    # 1. **折り返しが出た。** 迂回の候補が「始点の x から、終点の x へ」の1本しか無く、
    #    よけるべきカードが始点の手前にあると、いったん戻ってから進む形になっていた。
    # 2. **出る向きを無視していた。** カードの下辺から出る線なのに、
    #    最初の一歩が横だったりする。曲がる回数が増え、どこから出た線か読めない。
    # 3. **最良の候補がまだぶつかっていても、そのまま採用していた。**
    #    「よけられませんでした」と言わずに、カードの上を通る線を返していた。
    #
    # ## いまの作り
    #
    # **助走 → 通り道 → 助走** の3区間で組む。
    #
    #     ┌─ 助走(28px) ── カードから必ずまっすぐ離れる
    #     │
    #     └──────── 通り道 ──────┐
    #                            │
    #                            └─ 助走(28px) ── 相手の縁へまっすぐ入る
    #
    # 通り道は、カードの隙間（チャネル）から選ぶ。**候補を軸の両側から集める**ので、
    # 前後どちらへ回っても解ける。折り返しは起きない。
    #
    # 曲がりは多くても2回。**90度より鋭い角を作らない**。
    class Router
      # カードの縁から、まっすぐ離れる長さ。フロントの EDGE_STUB と揃える
      STUB = 28
      # よけるとき、カードからどれだけ離れるか
      CLEARANCE = 56

      # @param boxes [Hash<String, Box>] 盤の全カード
      def initialize(boxes:)
        @boxes = boxes
      end

      # @return [Array<Hash>] 折れ点。空なら直接つないでよい
      def route(source, target, source_handle, target_handle)
        return [] if source.nil? || target.nil?

        start_point = anchor(source, source_handle)
        end_point = anchor(target, target_handle)
        obstacles = @boxes.values.reject { |box| [ source.id, target.id ].include?(box.id) }

        # 助走の先。ここから先が通り道になる
        from = step_out(start_point, source_handle)
        to = step_out(end_point, target_handle)

        candidates(from, to, source_handle, obstacles).each do |points|
          route_points = [ from, *points, to ]
          next if hits_any?(start_point, route_points, end_point, obstacles)

          return trim(start_point, route_points, end_point)
        end

        # どれも通せなかった。**まっすぐ結ぶ**（嘘の迂回を返さない）
        []
      end

      private

      def anchor(box, handle)
        case handle
        when "top" then { x: box.center_x, y: box.top }
        when "bottom" then { x: box.center_x, y: box.bottom }
        when "right" then { x: box.right_edge, y: box.center_y }
        else { x: box.left_edge, y: box.center_y }
        end
      end

      # 出た辺の向きへ、まっすぐ離れた点
      def step_out(point, handle)
        case handle
        when "top" then { x: point[:x], y: point[:y] - STUB }
        when "bottom" then { x: point[:x], y: point[:y] + STUB }
        when "right" then { x: point[:x] + STUB, y: point[:y] }
        else { x: point[:x] - STUB, y: point[:y] }
        end
      end

      # 通り道の候補。**良さそうな順に並べる。**
      #
      # 最初に「まっすぐ」「L字」を試し、それで通らなければ
      # カードの隙間を通る道を、寄り道の少ない順に試す。
      def candidates(from, to, source_handle, obstacles)
        vertical_first = %w[top bottom].include?(source_handle)
        list = []

        # 既に軸に乗っているなら、折れ点は要らない
        list << [] if aligned?(from, to)

        # L字。出る向きにまっすぐ進んでから、直角に曲がって着く
        list << [ vertical_first ? { x: from[:x], y: to[:y] } : { x: to[:x], y: from[:y] } ]

        # コの字。真ん中で折り返す（曲がり2回）
        list << if vertical_first
          middle = (from[:y] + to[:y]) / 2
          [ { x: from[:x], y: middle }, { x: to[:x], y: middle } ]
        else
          middle = (from[:x] + to[:x]) / 2
          [ { x: middle, y: from[:y] }, { x: middle, y: to[:y] } ]
        end

        list + channel_routes(from, to, vertical_first, obstacles)
      end

      # カードの隙間を通る道。
      #
      # **両側から候補を集める。** 片側だけを見ていた頃は、
      # よけるべきカードが始点の手前にあると、戻ってから進む形になっていた。
      def channel_routes(from, to, vertical_first, obstacles)
        lines = if vertical_first
          obstacles.flat_map { |box| [ box.left - CLEARANCE, box.right + CLEARANCE ] }
        else
          obstacles.flat_map { |box| [ box.top - CLEARANCE, box.bottom + CLEARANCE ] }
        end

        # 寄り道の少ない順。遠くへ回る道は最後に試す
        anchor_value = vertical_first ? (from[:x] + to[:x]) / 2 : (from[:y] + to[:y]) / 2
        lines.uniq.sort_by { |value| (value - anchor_value).abs }.first(12).map do |value|
          # **先に横（縦）へ逃げてから、通り道を進む。**
          #
          # 真ん中まで進んでから曲がる形にしていたときは、
          # 曲がる前に障害物を突っ切っていた。逃げてから進めば、必ずよけられる
          if vertical_first
            [ { x: value, y: from[:y] }, { x: value, y: to[:y] } ]
          else
            [ { x: from[:x], y: value }, { x: to[:x], y: value } ]
          end
        end
      end

      def mid(a, b) = (a + b) / 2

      def aligned?(a, b)
        (a[:x] - b[:x]).abs < 1 || (a[:y] - b[:y]).abs < 1
      end

      # 道すじがどこかのカードに当たるか
      def hits_any?(start_point, points, end_point, obstacles)
        [ start_point, *points, end_point ].each_cons(2).any? do |a, b|
          obstacles.any? { |box| segment_hits?(a, b, box) }
        end
      end

      # 線分と、余白ぶん膨らませた矩形の交わり。
      # **斜めの線分は安全側で当たり扱い**にする（直交で組んでいるので出ないはず）
      def segment_hits?(a, b, box)
        left = box.left - CLEARANCE
        right = box.right + CLEARANCE
        top = box.top - CLEARANCE
        bottom = box.bottom + CLEARANCE

        if (a[:y] - b[:y]).abs < 1
          return false unless a[:y] > top && a[:y] < bottom

          overlaps?(a[:x], b[:x], left, right)
        elsif (a[:x] - b[:x]).abs < 1
          return false unless a[:x] > left && a[:x] < right

          overlaps?(a[:y], b[:y], top, bottom)
        else
          true
        end
      end

      def overlaps?(a1, a2, b1, b2)
        [ a1, a2 ].min < b2 && [ a1, a2 ].max > b1
      end

      # 折れ点を整える。
      # **同じ場所に重なった点と、まっすぐ続くだけの点を落とす**（曲がりの数を減らす）
      def trim(start_point, points, end_point)
        all = [ start_point, *points, end_point ].map { |p| { "x" => p[:x].round, "y" => p[:y].round } }
        kept = [ all.first ]
        all[1..].each do |point|
          previous = kept.last
          next if previous["x"] == point["x"] && previous["y"] == point["y"]

          # 直前と同じ向きに続くだけなら、途中の点は要らない
          if kept.size >= 2 && straight?(kept[-2], previous, point)
            kept[-1] = point
          else
            kept << point
          end
        end
        # 端の2点はカードの縁そのものなので、折れ点としては返さない
        kept[1..-2] || []
      end

      def straight?(a, b, c)
        (a["x"] == b["x"] && b["x"] == c["x"]) || (a["y"] == b["y"] && b["y"] == c["y"])
      end
    end
  end
end
