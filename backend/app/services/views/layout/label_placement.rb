# frozen_string_literal: true

module Views
  module Layout
    # 線の上の文字を、どこに置くか決める。
    #
    # ## なぜ要るのか
    #
    # 文字はこれまで**道のりの真ん中**に置いていた。1本ずつ見れば正しい。
    # だが同じ辺から出て同じ隙間を通る2本は、道すじがほぼ重なる。
    # 真ん中も重なるので、「姉妹」と「娘」が肩を並べて出て、
    # **どちらがどの線の文字なのか読めなくなる**。
    #
    # 線そのものは Router が散らす。それでも寄ったままの文字が残るので、
    # ここで**線に沿って前後へずらす**。線から離すのではなく線の上を滑らせるので、
    # どの線の文字かは見失われない。
    #
    # ## 決め方
    #
    # 真ん中から順に試し、**既に置いた文字と離れている最初の場所**を採る。
    # どこも空いていなければ真ん中に戻す（無理にずらして端へ寄せない）。
    class LabelPlacement
      # 道のりのどこに置くか（0=始点, 1=終点）
      CENTER = 0.5
      # 試す順。真ん中を最優先し、そこから前後へ開く
      SPOTS = [ 0.5, 0.35, 0.65, 0.25, 0.75 ].freeze

      # これより近いと重なって読めない。文字の大きさ（13px前後）と余白から
      MIN_DISTANCE = 46

      def self.call(routes:, labels:, links:)
        new(routes:, labels:, links:).call
      end

      def initialize(routes:, labels:, links:)
        @routes = routes
        @labels = labels
        @links = links
      end

      # @return [Array<Float, nil>] labels と同じ並び。文字が無い線は nil
      def call
        placed = []
        @labels.each_with_index.map do |label, index|
          next nil if label.blank?

          polyline = polyline_for(index)
          next nil if polyline.size < 2

          spot = choose(polyline, placed)
          placed << point_at(polyline, spot)
          spot
        end
      end

      private

      # 置ける場所のうち、既に置いた文字といちばん離れているもの。
      # **十分離れているものが見つかった時点で止める**（真ん中に近いほうを優先する）
      def choose(polyline, placed)
        best = CENTER
        best_distance = -1

        SPOTS.each do |spot|
          distance = nearest_distance(point_at(polyline, spot), placed)
          return spot if distance >= MIN_DISTANCE

          if distance > best_distance
            best = spot
            best_distance = distance
          end
        end
        best
      end

      def nearest_distance(point, placed)
        return Float::INFINITY if placed.empty?

        placed.map { |other| Math.hypot(point[:x] - other[:x], point[:y] - other[:y]) }.min
      end

      # 線の実体。**画面が描くのと同じ形**でなければ、ここで測った位置がずれる。
      # 画面はカードの縁（ポートぶんずらした点）から折れ点を通って相手の縁まで描く
      def polyline_for(index)
        route = @routes[index]
        link = @links[index]
        return [] if route.nil? || link.nil? || link[:from].nil? || link[:to].nil?

        [
          edge_point(link[:from], link[:source_handle], route.source_port),
          *route.points.map { |point| { x: point["x"].to_f, y: point["y"].to_f } },
          edge_point(link[:to], link[:target_handle], route.target_port)
        ]
      end

      def edge_point(box, handle, port)
        offset = port.to_f
        case handle
        when "top" then { x: box.center_x + offset, y: box.top }
        when "bottom" then { x: box.center_x + offset, y: box.bottom }
        when "right" then { x: box.right_edge, y: box.center_y + offset }
        else { x: box.left_edge, y: box.center_y + offset }
        end
      end

      # 道のりを t (0..1) だけ進んだ点。頂点の数ではなく**長さ**で測る
      def point_at(polyline, fraction)
        lengths = polyline.each_cons(2).map { |a, b| Math.hypot(b[:x] - a[:x], b[:y] - a[:y]) }
        total = lengths.sum
        return polyline.first if total.zero?

        target = total * fraction
        walked = 0.0
        lengths.each_with_index do |length, index|
          if walked + length >= target
            t = length.zero? ? 0 : (target - walked) / length
            a = polyline[index]
            b = polyline[index + 1]
            return { x: a[:x] + (b[:x] - a[:x]) * t, y: a[:y] + (b[:y] - a[:y]) * t }
          end
          walked += length
        end
        polyline.last
      end
    end
  end
end
