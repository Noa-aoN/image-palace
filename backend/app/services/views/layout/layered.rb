# frozen_string_literal: true

module Views
  module Layout
    # 階層に並べる。親を上、子をその下へ。
    #
    # ## なぜコードで解くのか
    #
    # これまでは「親は子の真ん中の上に置け」と日本語で AI に頼んでいた。
    # 守られるかは運任せで、守られても後段の押しのけが崩していた。
    #
    # 家系図が家系図に見えるかどうかは、**3つの決めごとを全部守れるか**で決まる。
    # どれも算数なので、AI に頼むより解いたほうが確実で、速く、毎回同じ結果になる。
    #
    #   1. 同じ深さのものは、同じ高さに並ぶ
    #   2. 兄弟は左から順に、重ならずに並ぶ
    #   3. **親は、子たちの真ん中の上に来る**
    #
    # ## 交差はどこで減るのか
    #
    # 3 は「親の位置を子から決める」ので、**同じ深さの中での並び順**が図の見え方を決める。
    # 順番が悪いと線が交差する。そこで重心法を数周まわす——
    # 「つながっている相手の平均の位置」へ寄せることを繰り返すと、交差が減っていく。
    # 総当りで最適解を出すのは現実的でないが、数周で見た目は十分よくなる。
    class Layered
      # 重心法を何周まわすか。**増やしても頭打ちになる。**
      # 4周で交差はほぼ落ち着き、それ以上は計算時間だけ伸びる
      BARYCENTER_PASSES = 4

      # 深さが1つ下がるときの、縦の間隔（カードの高さぶんは別に足す）
      LEVEL_GAP = Metrics::MIN_CARD_GAP
      # 隣り合う兄弟の、横の間隔
      SIBLING_GAP = Metrics::MIN_CARD_GAP
      # 別の親を持つかたまり同士の間隔。兄弟より広く取って、群れの境目を見せる
      GROUP_GAP = Metrics::MIN_CARD_GAP * 1.5

      # @param boxes [Array<Box>] 置くカード
      # @param edges [Array<Hash>] { from:, to: } の並び（向きがある）
      # @param roots [Array<String>] 先頭に置きたい id（無ければ自動で選ぶ）
      # @param horizontal [Boolean] true なら左から右へ流す
      def initialize(boxes:, edges:, roots: [], horizontal: false)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @edges = edges.select { |edge| @by_id.key?(edge[:from]) && @by_id.key?(edge[:to]) }
        @roots = roots.select { |id| @by_id.key?(id) }
        @horizontal = horizontal
      end

      def call
        levels = assign_levels
        order_within_levels!(levels)
        place!(levels)
        @boxes
      end

      private

      # 深さを割り当てる。
      #
      # **輪になっているところは切る。** 「A の親が B、B の親が A」のような
      # 書かれ方をしても図にはできるようにする（後ろへ戻る線を1本無視する）。
      def assign_levels
        children = Hash.new { |hash, key| hash[key] = [] }
        parents = Hash.new { |hash, key| hash[key] = [] }
        @edges.each do |edge|
          children[edge[:from]] << edge[:to]
          parents[edge[:to]] << edge[:from]
        end

        depth = {}
        # **親を持たないものは、全部を起点にする。**
        #
        # AI が挙げた根（@roots）だけを起点にしていた頃は、
        # 挙げられなかった親（配偶者など）がどこからもたどり着けず、
        # 「たどり着けなかったもの」として**子より下の段**に置かれていた。
        # AI の挙げる根は「いちばん上に置きたいもの」の助言であって、
        # 親を持たないものの全部ではない。
        starts = (@roots + natural_roots(parents)).uniq
        # 親を持たないものが1つも無い＝全部が輪の中。並びの先頭を起点にする
        starts = [ @boxes.first&.id ].compact if starts.empty?

        queue = starts.map { |id| [ id, 0 ] }
        starts.each { |id| depth[id] = 0 }
        until queue.empty?
          id, level = queue.shift
          children[id].each do |child|
            # **段の数はカードの枚数を超えない。**
            # 輪になっていると「A の子は B、B の子は A」を延々とたどって深くなり続ける。
            # 枚数で頭を打たせて、輪の1本を無視した形にする
            next if level + 1 >= @boxes.size
            # 既に見た深さ以上にはしない
            next if depth.key?(child) && depth[child] >= level + 1

            depth[child] = level + 1
            queue << [ child, level + 1 ]
          end
        end

        # どこからもたどり着けなかったものは、いちばん下へ置く（消さない）
        orphan_level = (depth.values.max || 0) + 1
        @boxes.each { |box| depth[box.id] ||= orphan_level }

        depth.group_by { |_, level| level }
             .sort_by(&:first)
             .map { |_, pairs| pairs.map { |id, _| @by_id[id] }.compact }
      end

      # 起点にするのは「親を持たず、子を持つ」もの。
      #
      # **つながりが1本も無いカードを起点にしない。** 起点にすると最上段へ並び、
      # 図の頭に、関係の無いカードが根と同じ高さで混ざる。
      # そういうカードは下にまとめる（消さずに、読み筋からは外す）
      def natural_roots(parents)
        connected = @edges.flat_map { |edge| [ edge[:from], edge[:to] ] }.to_set
        @boxes.map(&:id).select { |id| connected.include?(id) && parents[id].empty? }
      end

      # 同じ深さの中の並び順を決める。**ここで線の交差が減る。**
      #
      # 上から下へ、下から上へと交互に、「つながっている相手の平均の位置」へ寄せる。
      # 位置が決まっていない相手は数えない（数えると全部が中央へ集まる）。
      def order_within_levels!(levels)
        BARYCENTER_PASSES.times do |pass|
          order = pass.even? ? levels.each_index.to_a : levels.each_index.to_a.reverse
          order.each do |index|
            reference = pass.even? ? levels[index - 1] : levels[index + 1]
            next if index.zero? && pass.even?
            next if reference.nil? || reference.empty?

            sort_by_barycenter!(levels[index], reference)
          end
        end
      end

      def sort_by_barycenter!(level, reference)
        position = reference.each_with_index.to_h { |box, index| [ box.id, index.to_f ] }
        neighbours = Hash.new { |hash, key| hash[key] = [] }
        @edges.each do |edge|
          neighbours[edge[:to]] << edge[:from]
          neighbours[edge[:from]] << edge[:to]
        end

        # 相手が居ないものは、いまの並びの位置を保つ（勝手に先頭へ来ない）
        keep = level.each_with_index.to_h { |box, index| [ box.id, index.to_f ] }
        level.sort_by! do |box|
          known = neighbours[box.id].filter_map { |id| position[id] }
          known.empty? ? keep[box.id] : known.sum / known.size
        end
      end

      # 座標を置く。
      #
      # **下から上へ組む。** 子を先に並べてから親をその真ん中へ寄せると、
      # 「親は子の真ん中の上」が一度で決まる。上から置くと、子を並べたあとに
      # 親を動かすことになり、動かした親の親がまたずれる。
      def place!(levels)
        return if levels.empty?

        row_positions = level_offsets(levels)
        # まず下の段から、兄弟のかたまりごとに詰めて置く
        levels.reverse.each_with_index do |level, reversed_index|
          index = levels.size - 1 - reversed_index
          pack_level!(level, levels[index + 1])
        end
        # 段の高さを当てる
        levels.each_with_index do |level, index|
          level.each { |box| set_cross_axis(box, row_positions[index]) }
        end
        shift_to_origin!
      end

      # 段ごとの位置（縦なら y、横なら x）。段の中で一番大きいものに合わせる
      def level_offsets(levels)
        offset = Metrics::BOARD_PADDING.to_f
        levels.map do |level|
          current = offset
          extent = level.map { |box| @horizontal ? box.width : box.height }.max || 0
          offset += extent + LEVEL_GAP
          current
        end
      end

      # 1つの段を詰める。子が既に置かれていれば、親をその真ん中へ。
      def pack_level!(level, children_level)
        centers = children_level ? child_centers(children_level) : {}
        cursor = 0.0
        previous_parent = nil

        level.each do |box|
          wanted = centers[box.id]
          half = main_extent(box) / 2
          # 別の親のかたまりとは広めにあける
          gap = previous_parent && previous_parent != parent_key(box) ? GROUP_GAP : SIBLING_GAP
          lower_bound = cursor.zero? ? half : cursor + gap + half
          set_main_axis(box, [ wanted || lower_bound, lower_bound ].max)
          cursor = main_axis(box) + half
          previous_parent = parent_key(box)
        end
      end

      # 子たちの中間。**ここが家系図の要。**
      def child_centers(children_level)
        placed = children_level.to_h { |box| [ box.id, main_axis(box) ] }
        by_parent = Hash.new { |hash, key| hash[key] = [] }
        @edges.each do |edge|
          next unless placed.key?(edge[:to])

          by_parent[edge[:from]] << placed[edge[:to]]
        end
        by_parent.transform_values { |positions| (positions.min + positions.max) / 2 }
      end

      def parent_key(box)
        @edges.find { |edge| edge[:to] == box.id }&.fetch(:from)
      end

      # 縦に流すか横に流すかで、主軸と交差軸が入れ替わる
      def main_axis(box) = @horizontal ? box.center_y : box.center_x
      def main_extent(box) = @horizontal ? box.height : box.footprint_width

      def set_main_axis(box, value)
        @horizontal ? box.center_y = value : box.center_x = value
      end

      def set_cross_axis(box, value)
        @horizontal ? box.x = value : box.y = value
      end

      # 左上に余白を残した位置へ、全体を寄せる
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
