# frozen_string_literal: true

module Views
  module Layout
    # 中心から放射状に並べる。
    #
    # 主題を真ん中に置き、そこから伸びるものを周りへ配る形。
    # 階層と違うのは、**上下ではなく「中心からの遠さ」で深さを表す**こと。
    #
    # ## 角度の配り方
    #
    # 均等に配ると、子を多く持つ枝と1つしか持たない枝が同じ幅になり、
    # 前者の中で詰まって重なる。**その枝がぶら下げている末端の数**に比例して
    # 角度を配ると、どの枝も同じ密度で開く。
    class Radial
      # 深さが1つ増えるごとに広がる半径。カードの大きさと最低の隙間から決める
      RING_GAP = Metrics::CARD_WIDTH + Metrics::MIN_CARD_GAP

      def initialize(boxes:, edges:, roots: [])
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @edges = edges.select { |edge| @by_id.key?(edge[:from]) && @by_id.key?(edge[:to]) }
        @roots = roots.select { |id| @by_id.key?(id) }
      end

      def call
        tree = build_tree
        root = @roots.first || tree[:order].first
        return place_grid_fallback if root.nil?

        place_subtree(root, 0, 0.0, 2 * Math::PI, tree)
        place_unreached(tree)
        shift_to_origin!
        @boxes
      end

      private

      # 中心から一方向にたどった木。**同じカードを二度置かない。**
      def build_tree
        children = Hash.new { |hash, key| hash[key] = [] }
        @edges.each { |edge| children[edge[:from]] << edge[:to] }

        seen = Set.new
        ordered = Hash.new { |hash, key| hash[key] = [] }
        order = []

        walk = lambda do |id|
          return if seen.include?(id)

          seen << id
          order << id
          children[id].each do |child|
            next if seen.include?(child)

            ordered[id] << child
            walk.call(child)
          end
        end

        starts = @roots.presence || natural_roots(children)
        (starts + @boxes.map(&:id)).each { |id| walk.call(id) }

        { children: ordered, order: order, leaves: leaf_counts(ordered, order) }
      end

      def natural_roots(children)
        has_parent = @edges.map { |edge| edge[:to] }.to_set
        @boxes.map(&:id).select { |id| children[id].any? && !has_parent.include?(id) }
      end

      # 各枝がぶら下げている末端の数。角度を配る重みになる
      def leaf_counts(children, order)
        counts = {}
        order.reverse_each do |id|
          kids = children[id]
          counts[id] = kids.empty? ? 1 : kids.sum { |child| counts[child] || 1 }
        end
        counts
      end

      def place_subtree(id, depth, from_angle, to_angle, tree)
        box = @by_id[id]
        return unless box

        middle = (from_angle + to_angle) / 2
        radius = depth * RING_GAP
        box.center_x = Math.cos(middle) * radius
        box.center_y = Math.sin(middle) * radius

        kids = tree[:children][id]
        return if kids.empty?

        total = kids.sum { |child| tree[:leaves][child] || 1 }.to_f
        cursor = from_angle
        kids.each do |child|
          span = (to_angle - from_angle) * ((tree[:leaves][child] || 1) / total)
          place_subtree(child, depth + 1, cursor, cursor + span, tree)
          cursor += span
        end
      end

      # 木からたどり着けなかったカードは、いちばん外の輪へ等間隔に置く
      def place_unreached(tree)
        placed = tree[:order].to_set
        rest = @boxes.reject { |box| placed.include?(box.id) }
        return if rest.empty?

        radius = ((@boxes.map { |box| Math.hypot(box.center_x, box.center_y) }.max || 0) + RING_GAP)
        rest.each_with_index do |box, index|
          angle = 2 * Math::PI * index / rest.size
          box.center_x = Math.cos(angle) * radius
          box.center_y = Math.sin(angle) * radius
        end
      end

      # 線が1本も無いときは、放射にする意味が無い
      def place_grid_fallback
        Grid.new(boxes: @boxes).call
      end

      def shift_to_origin!
        return if @boxes.empty?

        dx = Metrics::BOARD_PADDING - @boxes.map(&:left).min
        dy = Metrics::BOARD_PADDING - @boxes.map(&:top).min
        @boxes.each do |box|
          box.x += dx
          box.y += dy
        end
      end
    end
  end
end
