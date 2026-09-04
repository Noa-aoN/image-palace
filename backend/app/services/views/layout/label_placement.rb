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
    # ## 点ではなく面で見る
    #
    # 最初は「置いた点どうしが 46px 離れているか」だけを見ていた。
    # **文字には高さと幅がある。** 点が離れていても、
    # 「オリュンポスの神々」のような長い語は横へ伸びて隣に被る。
    # 縦に並んだときは、たった 46px では2行ぶんに足りない。
    #
    # いまは文字を**矩形**として置き、次の3つを避ける。
    #
    #   1. 他の文字（重なると、どちらも読めない）
    #   2. 他の線（文字が線を隠す。線が文字を横切ると字が割れる）
    #   3. カード（文字がカードの上に乗ると、カードの見出しと混ざる）
    #
    # 自分が乗っている線だけは避けない。**線の上に置くのが仕事**なので。
    class LabelPlacement
      # 道のりのどこに置くか（0=始点, 1=終点）
      CENTER = 0.5
      # 試す順。真ん中を最優先し、そこから前後へ開く。
      # 端に寄りすぎると、どちらのカードの文字か紛れるので 0.2〜0.8 に収める
      SPOTS = [ 0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75, 0.2, 0.8 ].freeze

      # 文字の大きさの既定。画面の `s.label_size || 13` と揃える
      DEFAULT_FONT_SIZE = 13
      # 文字の周りの余白。画面は padding 2px 6px ＋ 1px の縁を持つ
      PADDING_X = 14
      PADDING_Y = 6
      # 行の高さ。画面の line-height 1.3 と揃える
      LINE_HEIGHT = 1.3
      # 隣り合う文字の間に、これだけは空ける
      BREATHING_ROOM = 8

      # 他のものに重なったときの重さ。**文字どうしがいちばん困る**
      PENALTY_LABEL = 100.0
      PENALTY_EDGE = 12.0
      PENALTY_CARD = 40.0

      # ── ここから下は、線の形だけで決まる算数 ──────────────────
      #
      # `Geometry` からも同じものを使う。**2か所に書くと、片方だけ直して食い違う**

      # カードの縁の、線が出入りする点。port は辺に沿ったずれ
      def self.edge_point(box, handle, port)
        Handles.point(box, handle, port.to_f)
      end

      # 道のりを t (0..1) だけ進んだ点。頂点の数ではなく**長さ**で測る
      def self.point_at(polyline, fraction)
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

      # 文字が占める面。見出しと同じ物差し（Metrics.text_units）で測る
      def self.rect_on(polyline, fraction, label, size)
        center = point_at(polyline, fraction)
        half_width = (Metrics.text_units(label) * size + PADDING_X + BREATHING_ROOM) / 2
        half_height = (size * LINE_HEIGHT + PADDING_Y + BREATHING_ROOM) / 2
        {
          left: center[:x] - half_width, right: center[:x] + half_width,
          top: center[:y] - half_height, bottom: center[:y] + half_height
        }
      end

      def self.call(routes:, labels:, links:, font_sizes: nil, boxes: nil)
        new(routes:, labels:, links:, font_sizes:, boxes:).call
      end

      def initialize(routes:, labels:, links:, font_sizes: nil, boxes: nil)
        @routes = routes
        @labels = labels
        @links = links
        @font_sizes = font_sizes
        @given_boxes = boxes
      end

      # @return [Array<Float, nil>] labels と同じ並び。文字が無い線は nil
      def call
        placed = []
        @labels.each_with_index.map do |label, index|
          next nil if label.blank?

          polyline = polylines[index]
          next nil if polyline.size < 2

          spot = choose(index, label, polyline, placed)
          placed << rect_at(polyline, spot, label, font_size(index))
          spot
        end
      end

      private

      # いちばん邪魔にならない場所。
      # **どこにも当たらない場所が見つかったら、そこで止める**（真ん中に近いほうを優先する）
      def choose(index, label, polyline, placed)
        best = CENTER
        best_cost = Float::INFINITY

        SPOTS.each do |spot|
          rect = rect_at(polyline, spot, label, font_size(index))
          cost = cost_of(rect, index, placed)
          return spot if cost.zero?

          if cost < best_cost
            best = spot
            best_cost = cost
          end
        end
        best
      end

      # 重なった量で測る。**「当たったか」ではなく「どれだけ当たったか」**。
      # 真偽だけで見ていると、少し掠っただけの場所と、丸ごと隠れる場所が同じ評価になる
      def cost_of(rect, index, placed)
        cost = placed.sum { |other| overlap_area(rect, other) } * PENALTY_LABEL
        cost += edge_crossing_length(rect, index) * PENALTY_EDGE
        cost + card_overlap(rect) * PENALTY_CARD
      end

      def overlap_area(a, b)
        width = [ a[:right], b[:right] ].min - [ a[:left], b[:left] ].max
        height = [ a[:bottom], b[:bottom] ].min - [ a[:top], b[:top] ].max
        return 0.0 if width <= 0 || height <= 0

        # 面積そのものだと長い文字が不利になりすぎる。辺の長さで正規化する
        (width * height) / (a[:right] - a[:left] + a[:bottom] - a[:top])
      end

      # 文字の矩形を横切る、**他の線**の長さ。自分が乗っている線は数えない
      def edge_crossing_length(rect, index)
        segments.sum do |segment|
          next 0.0 if segment[:route] == index

          clipped_length(rect, segment)
        end
      end

      # 線分のうち、矩形の中に入っている長さ。直交で組んであるので縦横だけ見る
      def clipped_length(rect, segment)
        if segment[:axis] == :horizontal
          return 0.0 unless segment[:fixed] > rect[:top] && segment[:fixed] < rect[:bottom]

          span(segment[:from], segment[:to], rect[:left], rect[:right])
        else
          return 0.0 unless segment[:fixed] > rect[:left] && segment[:fixed] < rect[:right]

          span(segment[:from], segment[:to], rect[:top], rect[:bottom])
        end
      end

      def span(from, to, low, high)
        [ [ to, high ].min - [ from, low ].max, 0.0 ].max
      end

      def card_overlap(rect)
        boxes.sum do |box|
          overlap_area(rect, { left: box.left_edge, right: box.right_edge, top: box.top, bottom: box.bottom })
        end
      end

      # ── 測るための下ごしらえ ──────────────────────────────

      def font_size(index)
        size = @font_sizes&.[](index).to_f
        size.positive? ? size.clamp(8, 48) : DEFAULT_FONT_SIZE
      end

      # 文字が占める面。見出しと同じ物差し（Metrics.text_units）で測る
      def rect_at(polyline, fraction, label, size) = self.class.rect_on(polyline, fraction, label, size)

      # 避けるカード。**盤の全部**を見る。
      # 線の両端だけを見ていた頃は、端へ寄せた文字が別のカードの上に乗っていた
      def boxes
        @boxes ||= (@given_boxes || @links.flat_map { |link| [ link[:from], link[:to] ] })
                   .compact.uniq(&:id)
      end

      def polylines
        @polylines ||= @labels.each_index.map { |index| polyline_for(index) }
      end

      # 盤の上の線分すべて。文字がどれを隠すかを測るのに使う
      def segments
        @segments ||= polylines.each_with_index.flat_map do |polyline, index|
          polyline.each_cons(2).filter_map { |a, b| segment_of(a, b, index) }
        end
      end

      def segment_of(a, b, route_index)
        if (a[:y] - b[:y]).abs < 1
          { route: route_index, axis: :horizontal, fixed: a[:y],
            from: [ a[:x], b[:x] ].min, to: [ a[:x], b[:x] ].max }
        elsif (a[:x] - b[:x]).abs < 1
          { route: route_index, axis: :vertical, fixed: a[:x],
            from: [ a[:y], b[:y] ].min, to: [ a[:y], b[:y] ].max }
        end
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

      def edge_point(box, handle, port) = self.class.edge_point(box, handle, port)

      def point_at(polyline, fraction) = self.class.point_at(polyline, fraction)
    end
  end
end
