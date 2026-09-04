# frozen_string_literal: true

module Views
  module Layout
    # 時系列に並べる。
    #
    # ## 階層図・流れ図と何が違うか
    #
    # 流れ図は「順番があるもの」を段に割って並べる。時系列図は
    # **時間の軸が1本あって、出来事はその上に並ぶ**。段は作らない。
    # 出来事に枝が付いても、枝は軸の下へ落とす（軸そのものは1本のまま）。
    #
    # ローマ史の例なら、「建国 → 帝政 → 分裂 → 滅亡」が軸に並び、
    # それぞれに紐づく説明が下へぶら下がる。
    #
    # ## 順番の決め方
    #
    # 向きのある関係をたどって鎖を作る。**いちばん長い鎖を軸にする。**
    # 鎖に入らなかったものは、繋がっている相手の下へ置く。
    # どこにも繋がらないものは、軸の右端の下へ並べる（消さない）。
    class Timeline
      # 軸の上で、出来事どうしをどれだけ空けるか
      EVENT_GAP = Metrics::MIN_CARD_GAP
      # 軸から、ぶら下がるカードまでの縦の隔たり
      BRANCH_GAP = Metrics::MIN_CARD_GAP

      # @param boxes [Array<Box>]
      # @param edges [Array<Hash>] { from:, to:, type: }
      def initialize(boxes:, edges:)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        # 同列の関係は時間を進めない（兄弟は同じ時点にいる）
        @edges = edges.select do |edge|
          @by_id.key?(edge[:from]) && @by_id.key?(edge[:to]) && edge[:type].to_s != "peer"
        end
      end

      def call
        return @boxes if @boxes.empty?

        axis = longest_chain
        branches = branches_for(axis)
        place_axis!(axis)
        place_branches!(axis, branches)
        place_leftovers!(axis, branches)
        @boxes
      end

      private

      # いちばん長い鎖を探す。**同じ長さなら id 順**（同じ入力から同じ図を出すため）
      def longest_chain
        next_of = @edges.group_by { |edge| edge[:from] }
                        .transform_values { |list| list.map { |edge| edge[:to] }.uniq.sort }
        best = []
        @boxes.map(&:id).sort.each do |id|
          chain = walk(id, next_of)
          best = chain if chain.size > best.size
        end
        best.presence || [ @boxes.min_by(&:id).id ]
      end

      # 鎖をたどる。**輪になっていても止まる**（一度通った所へは戻らない）
      def walk(start, next_of)
        chain = [ start ]
        seen = Set.new([ start ])
        loop do
          nxt = Array(next_of[chain.last]).find { |id| !seen.include?(id) }
          break if nxt.nil?

          chain << nxt
          seen << nxt
        end
        chain
      end

      # 軸に乗らなかったカードを、繋がっている相手ごとに束ねる
      def branches_for(axis)
        on_axis = axis.to_set
        branches = Hash.new { |hash, key| hash[key] = [] }
        @edges.each do |edge|
          if on_axis.include?(edge[:from]) && !on_axis.include?(edge[:to])
            branches[edge[:from]] << edge[:to]
          elsif on_axis.include?(edge[:to]) && !on_axis.include?(edge[:from])
            branches[edge[:to]] << edge[:from]
          end
        end
        branches.transform_values { |ids| ids.uniq.sort }
      end

      # 軸の上に、左から順に置く
      def place_axis!(axis)
        x = Metrics::BOARD_PADDING.to_f
        axis.each do |id|
          box = @by_id[id]
          next if box.nil?

          box.x = x
          box.y = Metrics::BOARD_PADDING.to_f
          x += box.footprint_width + EVENT_GAP
        end
      end

      # ぶら下がるカードは、**軸のカードの真下**へ縦に積む
      def place_branches!(axis, branches)
        row_top = axis_bottom(axis) + BRANCH_GAP
        branches.each do |anchor_id, ids|
          anchor = @by_id[anchor_id]
          next if anchor.nil?

          y = row_top
          ids.each do |id|
            box = @by_id[id]
            next if box.nil?

            box.center_x = anchor.center_x
            box.y = y
            y += box.height + Metrics::MIN_CARD_GAP
          end
        end
      end

      # どこにも繋がらないカード。**消さずに、軸の右端の下へ並べる**
      def place_leftovers!(axis, branches)
        placed = (axis + branches.values.flatten).to_set
        rest = @boxes.reject { |box| placed.include?(box.id) }
        return if rest.empty?

        Grid.new(boxes: rest).call
        shift_down = axis_bottom(axis) + BRANCH_GAP * 2
        deepest = branches.values.flatten.filter_map { |id| @by_id[id]&.bottom }.max
        offset = [ shift_down, deepest.to_f + BRANCH_GAP ].max
        rest.each { |box| box.y += offset }
      end

      def axis_bottom(axis)
        axis.filter_map { |id| @by_id[id]&.bottom }.max || Metrics::BOARD_PADDING.to_f
      end
    end
  end
end
