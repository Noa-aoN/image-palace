# frozen_string_literal: true

module Views
  module Layout
    # マインドマップ。
    #
    # ## 放射（Radial）との違い
    #
    # どちらも中心から広がるが、**開く向きが違う**。
    #   放射       … 360度へ均等に。中心との距離が意味を持つ図に向く
    #   マインドマップ … 左右へ振り分ける。**紙に書くときの形**で、横長の画面に収まりやすい
    #
    # 放射は枝が上下にも伸びるので、枝の文字が縦に重なりやすい。
    # マインドマップは枝が必ず横へ伸びるので、**文字が読める向きに揃う**。
    #
    # ## 手で書くときの決まりを、そのまま写す
    #
    #   1. 中心はひとつ。主題を真ん中に置く
    #   2. 大枝は**左右に振り分ける**。片側に寄せない
    #   3. 小枝は、その大枝と**同じ側へ**伸ばす（左の枝の子は、さらに左へ）
    #   4. 同じ側の枝は縦に積む。**ぶら下げる数に応じて場所を配る**
    #      （子を多く持つ枝と1つの枝を同じ幅にすると、前者の中で詰まる）
    class Mindmap
      # 段が1つ深くなるときの横の距離
      BRANCH_GAP = Metrics::CARD_WIDTH + Metrics::MIN_CARD_GAP
      # 同じ側で縦に積むときの間隔
      STACK_GAP = Metrics::MIN_CARD_GAP

      # @param vertical [Boolean] true なら上下へ振り分ける（既定は左右）
      def initialize(boxes:, edges:, roots: [], vertical: false)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @edges = edges.select { |edge| @by_id.key?(edge[:from]) && @by_id.key?(edge[:to]) }
        @roots = roots.select { |id| @by_id.key?(id) }
        @vertical = vertical
      end

      def call
        tree = build_tree
        center = @roots.first || tree[:order].first
        return Grid.new(boxes: @boxes).call if center.nil?

        place_center(center)
        place_branches(center, tree)
        place_unreached(tree)
        shift_to_origin!
        @boxes
      end

      private

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

        { children: ordered, order: order, weights: weights(ordered, order) }
      end

      def natural_roots(children)
        has_parent = @edges.map { |edge| edge[:to] }.to_set
        @boxes.map(&:id).select { |id| children[id].any? && !has_parent.include?(id) }
      end

      # 枝の重み。**ぶら下げている末端の数**。場所を配る比率になる
      def weights(children, order)
        counts = {}
        order.reverse_each do |id|
          kids = children[id]
          counts[id] = kids.empty? ? 1 : kids.sum { |child| counts[child] || 1 }
        end
        counts
      end

      def place_center(center)
        box = @by_id[center]
        box.center_x = 0.0
        box.center_y = 0.0
      end

      # 大枝を左右へ振り分ける。**重みが釣り合うように配る**
      # （数で半分ずつにすると、片側だけ縦に長くなる）
      def place_branches(center, tree)
        branches = tree[:children][center]
        return if branches.empty?

        right, left = split_by_weight(branches, tree[:weights])
        place_side(right, 1, tree)
        place_side(left, -1, tree)
      end

      def split_by_weight(branches, weights)
        right = []
        left = []
        right_weight = 0
        left_weight = 0
        # 重い枝から順に、軽いほうの側へ入れる
        branches.sort_by { |id| -(weights[id] || 1) }.each do |id|
          if right_weight <= left_weight
            right << id
            right_weight += weights[id] || 1
          else
            left << id
            left_weight += weights[id] || 1
          end
        end
        # 並びは元の順に戻す（同じ入力から同じ図が出るように）
        [ branches.select { |id| right.include?(id) }, branches.select { |id| left.include?(id) } ]
      end

      def place_side(branches, direction, tree)
        return if branches.empty?

        total = branches.sum { |id| tree[:weights][id] || 1 }.to_f
        span = total * (Metrics::CARD_HEIGHT + STACK_GAP)
        cursor = -span / 2

        branches.each do |id|
          weight = (tree[:weights][id] || 1).to_f
          height = span * (weight / total)
          place_branch(id, direction, 1, cursor, cursor + height, tree)
          cursor += height
        end
      end

      # 枝と、その先。**同じ側へ伸ばし続ける**
      def place_branch(id, direction, depth, from_y, to_y, tree)
        box = @by_id[id]
        return unless box

        # 主軸＝広がる向き、交差軸＝積む向き。上下へ振り分けるときは入れ替わる
        out = direction * depth * BRANCH_GAP
        across = (from_y + to_y) / 2
        if @vertical
          box.center_y = out
          box.center_x = across
        else
          box.center_x = out
          box.center_y = across
        end

        kids = tree[:children][id]
        return if kids.empty?

        total = kids.sum { |child| tree[:weights][child] || 1 }.to_f
        cursor = from_y
        kids.each do |child|
          height = (to_y - from_y) * ((tree[:weights][child] || 1) / total)
          place_branch(child, direction, depth + 1, cursor, cursor + height, tree)
          cursor += height
        end
      end

      # 枝からたどり着けなかったカードは、下にまとめる（消さない）
      def place_unreached(tree)
        placed = tree[:order].to_set
        rest = @boxes.reject { |box| placed.include?(box.id) }
        return if rest.empty?

        bottom = (@boxes.map(&:bottom).max || 0) + Metrics::MIN_CARD_GAP
        Grid.new(boxes: rest).call
        dy = bottom - rest.map(&:top).min
        rest.each { |box| box.y += dy }
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
