# frozen_string_literal: true

module Views
  module Layout
    # 図として**実際に描かれるもの**を組み立てる。
    #
    # ## なぜ切り出したか
    #
    # 線の道すじと、線の上の文字の場所は、これまで
    # 「配置が決まったあと、書き込む直前」にしか計算していなかった。
    # そのため質を測る `Score` は、線を**両端を結ぶ直線**として見るしかなく、
    # **測っている図と、目に見える図が別物**だった。
    # 交差の数を減らしても、実際の図の交差は減らない。
    #
    # ここに集めれば、
    #   ・候補を作った時点で、実物の幾何で質を測れる
    #   ・測ったものと書き込むものが、必ず同じになる
    #
    # 「どの辺から出るか」の決め方もここに置く。**2か所に置くと、
    # 片方だけ直して食い違う**（実際、線を引く側と測る側で食い違っていた）。
    class Geometry
      # 1本の線について、描くのに要るもの一式
      Line = Struct.new(
        :relation, :source, :target, :source_handle, :target_handle,
        :route, :polyline, :label, :label_spot, :label_rect,
        keyword_init: true
      )

      # @param boxes [Hash<String, Box>, Array<Box>] 盤のカード
      # @param relations [Array<Hash>] { from:, to:, label:, ... }
      # @param obstacles [Hash<String, Box>] カード以外によけるもの（図形）
      # @param font_sizes [Array<Integer>, nil] 線ごとの文字の大きさ
      def self.call(boxes:, relations:, obstacles: {}, font_sizes: nil)
        new(boxes:, relations:, obstacles:, font_sizes:).call
      end

      def initialize(boxes:, relations:, obstacles: {}, font_sizes: nil)
        @by_id = boxes.is_a?(Hash) ? boxes : boxes.to_h { |box| [ box.id, box ] }
        @relations = relations
        @obstacles = obstacles
        @font_sizes = font_sizes
      end

      # @return [Array<Line>] relations と同じ並び。端が盤に無い線も nil にせず返す
      def call
        links = @relations.map do |relation|
          source = @by_id[relation[:from]]
          target = @by_id[relation[:to]]
          source_handle, target_handle = self.class.handles_for(source, target)
          { from: source, to: target, source_handle:, target_handle: }
        end

        routes = router.route_all(links)
        labels = @relations.map { |relation| relation[:label].presence }
        spots = LabelPlacement.call(
          routes:, labels:, links:, font_sizes: @font_sizes, boxes: @by_id.values
        )

        @relations.each_with_index.map do |relation, index|
          build_line(relation, links[index], routes[index], labels[index], spots[index])
        end
      end

      # **段が違うなら、必ず縦に出す。**
      #
      # 中心どうしの遠さで決めていた頃は、親から離れた子への線が横から出ていた。
      # 家系図で親の横から線が出ると、その線は同じ段のカードの前を通ることになり、
      # 兄弟の並びを横切る。段が違うなら上下に抜けるのが読み筋に合う。
      def self.handles_for(source, target)
        return [ nil, nil ] if source.nil? || target.nil?

        dx = target.center_x - source.center_x
        dy = target.center_y - source.center_y
        # 段が違うとみなす縦の隔たり。カードの高さぶん離れていれば別の段
        apart = (source.height + target.height) / 2

        if dy.abs >= apart || dy.abs >= dx.abs
          dy.positive? ? [ "bottom", "top" ] : [ "top", "bottom" ]
        else
          dx.positive? ? [ "right", "left" ] : [ "left", "right" ]
        end
      end

      private

      def router
        @router ||= Router.new(boxes: @by_id.merge(@obstacles))
      end

      def build_line(relation, link, route, label, spot)
        Line.new(
          relation:, source: link[:from], target: link[:to],
          source_handle: link[:source_handle], target_handle: link[:target_handle],
          route:, label:, label_spot: spot,
          polyline: polyline_for(link, route),
          label_rect: label && spot ? label_rect(link, route, label, spot) : nil
        )
      end

      # 画面が描くのと同じ形。カードの縁（ポートぶんずらした点）から
      # 折れ点を通って相手の縁まで
      def polyline_for(link, route)
        return [] if route.nil? || link[:from].nil? || link[:to].nil?

        [
          LabelPlacement.edge_point(link[:from], link[:source_handle], route.source_port),
          *route.points.map { |point| { x: point["x"].to_f, y: point["y"].to_f } },
          LabelPlacement.edge_point(link[:to], link[:target_handle], route.target_port)
        ]
      end

      def label_rect(link, route, label, spot)
        polyline = polyline_for(link, route)
        return nil if polyline.size < 2

        LabelPlacement.rect_on(polyline, spot, label, LabelPlacement::DEFAULT_FONT_SIZE)
      end
    end
  end
end
