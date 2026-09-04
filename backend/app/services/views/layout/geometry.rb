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
        links = assign_handles

        routes = router.route_all(links)
        # **同じ関係の線は、1本の幹にまとめる。**
        # まとめられる組だけ差し替える（まとめない組は普通に引いたまま）
        apply_bus!(links, routes)
        labels = @relations.map { |relation| relation[:label].presence }
        spots = LabelPlacement.call(
          routes:, labels:, links:, font_sizes: @font_sizes, boxes: @by_id.values
        )

        @relations.each_with_index.map do |relation, index|
          build_line(relation, links[index], routes[index], labels[index], spots[index])
        end
      end

      # どの辺から出すか。
      #
      # **段が違うなら、必ず縦に出す。**
      # 中心どうしの遠さで決めていた頃は、親から離れた子への線が横から出ていた。
      # 家系図で親の横から線が出ると、その線は同じ段のカードの前を通ることになり、
      # 兄弟の並びを横切る。段が違うなら上下に抜けるのが読み筋に合う。
      #
      # **意味も見る。** 同列（夫婦・兄弟）は横につながるもので、
      # 上下に出すと親子の線と見分けが付かなくなる。同じ段に居るなら必ず横へ出す。
      def self.handles_for(source, target, type: nil)
        return [ nil, nil ] if source.nil? || target.nil?

        dx = target.center_x - source.center_x
        dy = target.center_y - source.center_y
        # 段が違うとみなす縦の隔たり。カードの高さぶん離れていれば別の段
        apart = (source.height + target.height) / 2
        same_level = dy.abs < apart

        # 同列の関係は、同じ段に居るかぎり横で結ぶ
        return dx.positive? ? [ "right", "left" ] : [ "left", "right" ] if Relation.same_level?(type) && same_level

        if dy.abs >= apart || dy.abs >= dx.abs
          dy.positive? ? [ "bottom", "top" ] : [ "top", "bottom" ]
        else
          dx.positive? ? [ "right", "left" ] : [ "left", "right" ]
        end
      end

      private

      # 辺と、辺のどの点に付けるかを決める。
      #
      # ## なぜ点まで決めるのか
      #
      # 辺だけ決めて真ん中から出していた頃は、同じ辺を使う線が1点に集まった。
      # ずれ（ポート）で散らしてはいたが、**手で引く線とは別の仕組み**だったので、
      # 手で引いた線と AI が引いた線が同じ辺で噛み合わなかった。
      #
      # いまは**手で選べるのと同じ3点**に割り当てる。3本までは点がそのまま分かれ、
      # 4本以上になったときだけ、点の周りへさらに散らす（Router のポート）。
      #
      # ## 並べる順
      #
      # 相手の位置で並べる。左の相手には左の点、右の相手には右の点。
      # **こうすると扇の中で線どうしが交差しない。**
      def assign_handles
        links = @relations.map do |relation|
          source = @by_id[relation[:from]]
          target = @by_id[relation[:to]]
          source_handle, target_handle = self.class.handles_for(source, target, type: relation[:type])
          { from: source, to: target, source_handle:, target_handle: }
        end
        spread_across_points!(links)
        links
      end

      # 同じ辺を使う線を、その辺の3点へ配る
      def spread_across_points!(links)
        groups = Hash.new { |hash, key| hash[key] = [] }
        links.each_with_index do |link, index|
          next if link[:from].nil? || link[:to].nil?

          groups[[ link[:from].id, Handles.side(link[:source_handle]) ]] << [ index, :source_handle, link[:to] ]
          groups[[ link[:to].id, Handles.side(link[:target_handle]) ]] << [ index, :target_handle, link[:from] ]
        end

        groups.each do |(_id, side), entries|
          # 3本より多いなら、点で分けきれない。Router のポートに任せて真ん中から出す
          next if entries.size > Handles::POINTS

          vertical_side = !Handles.horizontal_side?(side)
          sorted = entries.sort_by do |index, _key, other|
            [ vertical_side ? other.center_x : other.center_y, index ]
          end
          # 真ん中から外へ配る。**本数が少ないときに端へ寄せない**
          slots = slots_for(sorted.size)
          sorted.each_with_index do |(index, key, _other), position|
            links[index][key] = Handles.name(side, slots[position])
          end
        end
      end

      # 本数に対して、どの点を使うか。
      #   1本 … 真ん中
      #   2本 … 両端（真ん中を空けると、2本が離れて読みやすい）
      #   3本 … 全部
      def slots_for(count)
        case count
        when 1 then [ Handles::CENTER ]
        when 2 then [ 0, Handles::POINTS - 1 ]
        else (0...Handles::POINTS).to_a
        end
      end

      def router
        @router ||= Router.new(boxes: @by_id.merge(@obstacles))
      end

      def bus
        @bus ||= Bus.new(boxes: @by_id, relations: @relations)
      end

      # 幹を通る線を、幹の道すじへ差し替える。
      #
      # **通せなかった線はそのまま**。無理に幹へ寄せると、かえって遠回りになる
      def apply_bus!(links, routes)
        @relations.each_with_index do |relation, index|
          group = bus.group_for(relation)
          next if group.nil?

          # **幹を通る線は、ポートを散らさない。**
          # 散らすと、要から渡しまでの縦が本数ぶん並び、
          # せっかく束ねたものが根元でほどける（共有部分が1本に見えない）
          replacement = bus.route(group, relation, source_port: 0)
          routes[index] = replacement if replacement
        end
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
