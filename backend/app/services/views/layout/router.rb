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

      # 同じ辺から出入りする線どうしの間隔。
      # **1つの辺の中心から全部出していた頃は、扇の根元が1本に見えていた。**
      # どれがどこへ向かう線か読めず、線の上の文字も同じ場所に重なっていた
      PORT_GAP = 34
      # 辺の端に寄せすぎない余白。角から出ると、どちらの辺の線か分からなくなる
      PORT_MARGIN = 14

      # 同じ道すじを通ってしまった線をずらす幅。
      #
      # **線を分けるだけでは足りない。線の上には文字が乗る。**
      # 16px にしていた頃は、線どうしは確かに分かれていたが、
      # 文字（高さ約31px）の上端が隣の車線に掛かっていた。
      # 半分の 15.5px が車線の間隔 16px とほぼ同じなので、必ず縁が触れる。
      #
      # 文字がまるごと収まる幅を取る。線だけを見て決めない
      LANE_GAP = 40
      # 「同じ道すじ」とみなす差
      LANE_TOLERANCE = 3
      # ずらす本数の上限。これを超えると盤が線で埋まる
      MAX_LANES = 5

      # @param boxes [Hash<String, Box>] 盤の全カード
      def initialize(boxes:)
        @boxes = boxes
      end

      # 線をまとめて引く。
      #
      # **1本ずつ引くと、線どうしの重なりは原理的に解けない。**
      # 隣の線がどこを通るかを知らないまま最短路を選ぶので、
      # 同じ辺から出る線は同じ点から出て、同じ隙間を通って、同じ所に着く。
      # 軌跡が重なれば、線の上の文字も重なる。
      #
      # まとめて引けば、①辺のどこから出すか（ポート）を割り振れる
      # ②通り道が重なった線をずらせる。
      #
      # @param links [Array<Hash>] { from:, to:, source_handle:, target_handle: }
      # @return [Array<Route>] links と同じ並び
      def route_all(links)
        ports = assign_ports(links)
        routes = links.map.with_index do |link, index|
          source_port = ports.dig(index, :source).to_f
          target_port = ports.dig(index, :target).to_f
          Route.new(
            points: route(link[:from], link[:to], link[:source_handle], link[:target_handle],
                          source_port: source_port, target_port: target_port),
            source_port: source_port.round,
            target_port: target_port.round
          )
        end
        separate_lanes!(routes, links, ports)
        routes
      end

      # 引けた線。points は折れ点、port は辺の中心からのずれ（px）
      Route = Struct.new(:points, :source_port, :target_port, keyword_init: true)

      # @return [Array<Hash>] 折れ点。空なら直接つないでよい
      def route(source, target, source_handle, target_handle, source_port: 0, target_port: 0)
        return [] if source.nil? || target.nil?

        start_point = anchor(source, source_handle, source_port)
        end_point = anchor(target, target_handle, target_port)
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

      # 辺のどこから出るか。offset は辺の中心からのずれ
      def anchor(box, handle, offset = 0)
        case handle
        when "top" then { x: box.center_x + offset, y: box.top }
        when "bottom" then { x: box.center_x + offset, y: box.bottom }
        when "right" then { x: box.right_edge, y: box.center_y + offset }
        else { x: box.left_edge, y: box.center_y + offset }
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

      # ── 辺のどこから出すか（ポート）──────────────────────────
      #
      # 同じ辺を使う線を集め、辺の幅いっぱいに散らす。
      # 並べる順は**相手の位置**で決める。近い相手ほど近いポートから出せば、
      # 扇の中で線どうしが交差しない。
      def assign_ports(links)
        slots = Hash.new { |hash, key| hash[key] = [] }

        links.each_with_index do |link, index|
          from = link[:from]
          to = link[:to]
          next if from.nil? || to.nil?

          slots[[ from.id, link[:source_handle] ]] << { index:, role: :source, box: from, other: to }
          slots[[ to.id, link[:target_handle] ]] << { index:, role: :target, box: to, other: from }
        end

        ports = Hash.new { |hash, key| hash[key] = {} }
        slots.each do |(_id, handle), entries|
          offsets_for(entries, handle).each { |entry, offset| ports[entry[:index]][entry[:role]] = offset }
        end
        ports
      end

      def offsets_for(entries, handle)
        vertical_side = %w[top bottom].include?(handle)
        span = vertical_side ? entries.first[:box].width : entries.first[:box].height
        usable = [ span - PORT_MARGIN * 2, 0 ].max
        count = entries.size
        gap = count <= 1 ? 0 : [ PORT_GAP, usable / (count - 1).to_f ].min

        sorted = entries.sort_by do |entry|
          [ vertical_side ? entry[:other].center_x : entry[:other].center_y, entry[:index] ]
        end
        sorted.each_with_index.map { |entry, i| [ entry, (i - (count - 1) / 2.0) * gap ] }
      end

      # ── 同じ道すじを通る線をずらす ──────────────────────────
      #
      # ポートを散らしても、途中で同じ隙間へ吸い寄せられることがある
      # （通り道の候補が同じなので当然そうなる）。重なった区間だけを、
      # 別の車線へ寄せる。**寄せられなければ元に戻す**（よけたつもりの嘘を残さない）
      def separate_lanes!(routes, links, ports)
        clusters(collect_segments(routes)).each do |cluster|
          assign_lanes(cluster).each do |segment, lane|
            next if lane.zero?

            shift_segment!(routes[segment[:route]].points, segment, lane_delta(lane))
          end
        end

        routes.each_with_index { |route, index| revert_unless_clear!(route, links[index], ports[index]) }
      end

      def collect_segments(routes)
        routes.each_with_index.flat_map do |route, route_index|
          points = route.points
          (0...[ points.size - 1, 0 ].max).filter_map do |at|
            segment_of(points[at], points[at + 1], route_index, at)
          end
        end
      end

      def segment_of(a, b, route_index, at)
        dx = (a["x"] - b["x"]).abs
        dy = (a["y"] - b["y"]).abs
        axis = if dy <= LANE_TOLERANCE && dx > LANE_TOLERANCE then :horizontal
        elsif dx <= LANE_TOLERANCE && dy > LANE_TOLERANCE then :vertical
        end
        return nil if axis.nil?

        values = axis == :horizontal ? [ a["x"], b["x"] ] : [ a["y"], b["y"] ]
        { route: route_index, at:, axis:,
          fixed: axis == :horizontal ? a["y"] : a["x"],
          from: values.min, to: values.max }
      end

      # 同じ向き・ほぼ同じ位置の区間をひとまとめにする
      def clusters(segments)
        segments.group_by { |segment| segment[:axis] }.values.flat_map do |same_axis|
          same_axis.sort_by { |segment| [ segment[:fixed], segment[:from] ] }
                   .slice_when { |a, b| (b[:fixed] - a[:fixed]).abs > LANE_TOLERANCE }
                   .to_a
        end
      end

      # 区間が重なっているものだけ、別の車線へ回す
      def assign_lanes(cluster)
        return [] if cluster.size < 2

        taken = Hash.new { |hash, key| hash[key] = [] }
        cluster.map do |segment|
          lane = (0...MAX_LANES).find do |candidate|
            taken[candidate].none? { |other| overlaps?(segment[:from], segment[:to], other[:from], other[:to]) }
          end || 0
          taken[lane] << segment
          [ segment, lane ]
        end
      end

      # 0 は動かさない。1 から左右（上下）へ交互に開く
      def lane_delta(lane)
        step = (lane + 1) / 2
        lane.odd? ? step * LANE_GAP : -step * LANE_GAP
      end

      def shift_segment!(points, segment, delta)
        key = segment[:axis] == :horizontal ? "y" : "x"
        points[segment[:at]][key] += delta
        points[segment[:at] + 1][key] += delta
      end

      # ずらした結果、カードに当たる・助走が裏返るなら、引き直して元へ戻す
      def revert_unless_clear!(route, link, port)
        from = link[:from]
        to = link[:to]
        return if from.nil? || to.nil? || route.points.empty?

        start_point = anchor(from, link[:source_handle], port[:source].to_f)
        end_point = anchor(to, link[:target_handle], port[:target].to_f)
        obstacles = @boxes.values.reject { |box| [ from.id, to.id ].include?(box.id) }
        return if stubs_outward?(route.points, start_point, end_point, link) &&
                  !hits_any?(start_point, symbolized(route.points), end_point, obstacles)

        route.points = route(from, to, link[:source_handle], link[:target_handle],
                             source_port: port[:source].to_f, target_port: port[:target].to_f)
      end

      def symbolized(points)
        points.map { |point| { x: point["x"], y: point["y"] } }
      end

      # 助走が、出た辺の外を向いたままか。裏返ると線が端で折り返して見える
      def stubs_outward?(points, start_point, end_point, link)
        outward?(points.first, start_point, link[:source_handle]) &&
          outward?(points.last, end_point, link[:target_handle])
      end

      # ずらしても、助走はこれだけは残す
      MIN_STUB = 8

      def outward?(point, anchor_point, handle)
        case handle
        when "top" then anchor_point[:y] - point["y"] >= MIN_STUB
        when "bottom" then point["y"] - anchor_point[:y] >= MIN_STUB
        when "right" then point["x"] - anchor_point[:x] >= MIN_STUB
        when "left" then anchor_point[:x] - point["x"] >= MIN_STUB
        else true
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
