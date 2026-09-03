# frozen_string_literal: true

module Views
  module Layout
    # 出来上がった図の質を数える。
    #
    # **良し悪しを言葉ではなく数で持つ。** そうすると
    #   ・案を何通りか作って比べられる
    #   ・良くなったのか悪くなったのかをテストで固定できる
    #   ・「線の交差が3か所残りました」と利用者に言える
    #   ・あとから重みを変えて、図の好みを調整できる
    #
    # ## 何を測るか
    #
    # 図の良さを完全に測る式は無い。ここでは**目で見て分かる崩れ**を数える。
    #
    #   邪魔になるもの … 重なり / 線がカードを横切る / 線どうしの交差 / 文字の衝突
    #   締まりのなさ   … 線が長い / 余白が偏る
    #   読み筋         … 軸が揃っているか / 関係の強さと距離が合っているか
    #                     / 群れがまとまっているか / 向きが揃っているか
    #
    # 測るために配置より時間をかけては本末転倒なので、**安いものだけ**にする。
    class Score
      # 重み。**重なりだけは桁を変える**（1つでもあれば失格に近い）
      WEIGHT_OVERLAP = 1000.0
      WEIGHT_EDGE_CARD = 60.0
      WEIGHT_LABEL_CLASH = 40.0
      WEIGHT_EDGE_CROSS = 12.0
      WEIGHT_LENGTH = 0.002
      WEIGHT_MOVE = 0.004
      # 加点側。**減点より軽くする。** 崩れを直すほうが、整えるより先
      BONUS_ALIGNMENT = 30.0
      BONUS_STRENGTH_FIT = 25.0
      BONUS_GROUP_COHESION = 25.0
      BONUS_FLOW = 20.0

      # 線の上に載る文字が占めるおおよその大きさ。衝突を数えるのに使う
      LABEL_WIDTH = 80.0
      LABEL_HEIGHT = 24.0
      # 軸に乗っているとみなす誤差
      AXIS_EPSILON = 8.0

      attr_reader :overlaps, :edge_card_crossings, :edge_crossings, :label_clashes,
                  :total_length, :movement, :alignment_ratio, :strength_fit,
                  :group_cohesion, :flow_consistency

      # @param relations [Array<Hash>] { from:, to:, strength: }
      # @param groups [Array<Hash>] { members: [id] }
      def initialize(boxes:, edges:, previous: {}, move_weight: 1.0, groups: [])
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @edges = edges.select { |edge| @by_id.key?(edge[:from]) && @by_id.key?(edge[:to]) }
        @previous = previous
        @move_weight = move_weight
        @groups = groups
        measure!
      end

      # 小さいほど良い
      def penalty
        penalties - bonuses
      end

      def penalties
        WEIGHT_OVERLAP * overlaps +
          WEIGHT_EDGE_CARD * edge_card_crossings +
          WEIGHT_LABEL_CLASH * label_clashes +
          WEIGHT_EDGE_CROSS * edge_crossings +
          WEIGHT_LENGTH * total_length +
          WEIGHT_MOVE * @move_weight * movement
      end

      def bonuses
        BONUS_ALIGNMENT * alignment_ratio * @edges.size +
          BONUS_STRENGTH_FIT * strength_fit * @edges.size +
          BONUS_GROUP_COHESION * group_cohesion * @groups.size +
          BONUS_FLOW * flow_consistency * @edges.size
      end

      # 利用者に伝える一言。**良かったことは言わない**（読むべきものだけ残す）
      def notes
        remarks = []
        remarks << "カードが#{overlaps}か所で重なっています" if overlaps.positive?
        remarks << "線が#{edge_card_crossings}か所でカードを横切っています" if edge_card_crossings.positive?
        remarks << "線の文字が#{label_clashes}か所で重なっています" if label_clashes.positive?
        remarks << "線が#{edge_crossings}か所で交わっています" if edge_crossings > 2
        remarks
      end

      def to_h
        {
          overlaps:, edge_card_crossings:, edge_crossings:, label_clashes:,
          total_length: total_length.round, movement: movement.round,
          alignment_ratio: alignment_ratio.round(3), strength_fit: strength_fit.round(3),
          group_cohesion: group_cohesion.round(3), flow_consistency: flow_consistency.round(3),
          penalty: penalty.round(2)
        }
      end

      private

      def measure!
        @overlaps = count_overlaps
        segments = edge_segments
        @edge_card_crossings = count_edge_card_crossings(segments)
        @edge_crossings = count_edge_crossings(segments)
        @label_clashes = count_label_clashes(segments)
        @total_length = segments.sum { |a, b| (a[0] - b[0]).abs + (a[1] - b[1]).abs }
        @movement = count_movement
        @alignment_ratio = measure_alignment(segments)
        @strength_fit = measure_strength_fit
        @group_cohesion = measure_group_cohesion
        @flow_consistency = measure_flow(segments)
      end

      # ---- 邪魔になるもの ----------------------------------------------------

      def count_overlaps
        @boxes.combination(2).count do |a, b|
          (a.center_x - b.center_x).abs < (a.footprint_width + b.footprint_width) / 2 &&
            (a.center_y - b.center_y).abs < (a.height + b.height) / 2
        end
      end

      # 線を「両端を結ぶ直線」として見る。折れ点は経路を組んだ後に決まるので、
      # ここでは配置の良し悪しだけを見る
      def edge_segments
        @edges.map do |edge|
          from = @by_id[edge[:from]]
          to = @by_id[edge[:to]]
          [ [ from.center_x, from.center_y ], [ to.center_x, to.center_y ] ]
        end
      end

      def count_edge_card_crossings(segments)
        segments.each_with_index.sum do |(a, b), index|
          edge = @edges[index]
          @boxes.count do |box|
            next false if [ edge[:from], edge[:to] ].include?(box.id)

            segment_hits_box?(a, b, box)
          end
        end
      end

      def segment_hits_box?(a, b, box)
        steps = 12
        (1...steps).any? do |step|
          t = step.to_f / steps
          x = a[0] + (b[0] - a[0]) * t
          y = a[1] + (b[1] - a[1]) * t
          x > box.left && x < box.right && y > box.top && y < box.bottom
        end
      end

      # 線どうしの交わり。**端を共有するものは数えない**（必ず交わるため）
      def count_edge_crossings(segments)
        segments.combination(2).count do |(a1, a2), (b1, b2)|
          next false if [ a1, a2 ].intersect?([ b1, b2 ])

          crosses?(a1, a2, b1, b2)
        end
      end

      # 線の上の文字どうしの衝突と、文字がカードに乗ってしまう分。
      # **文字が読めない図は、線が正しくても伝わらない**
      def count_label_clashes(segments)
        labelled = segments.each_with_index.filter_map do |(a, b), index|
          next if @edges[index][:label].blank?

          [ (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 ]
        end

        clashes = labelled.combination(2).count do |p, q|
          (p[0] - q[0]).abs < LABEL_WIDTH && (p[1] - q[1]).abs < LABEL_HEIGHT
        end
        clashes + labelled.count { |p| @boxes.any? { |box| point_in_box?(p, box) } }
      end

      def point_in_box?(point, box)
        point[0] > box.left && point[0] < box.right && point[1] > box.top && point[1] < box.bottom
      end

      # ---- 読み筋 ------------------------------------------------------------

      # 軸の揃い。**線は水平・垂直だけで描かれる**ので、
      # つなぐ2枚が軸に乗っていないと線が階段状に折れる
      def measure_alignment(segments)
        return 0.0 if segments.empty?

        aligned = segments.count do |a, b|
          (a[0] - b[0]).abs < AXIS_EPSILON || (a[1] - b[1]).abs < AXIS_EPSILON
        end
        aligned.to_f / segments.size
      end

      # 関係の強さと距離が合っているか。**強い関係は近くにあってほしい。**
      # 強さを持たない線ばかりなら 0（加点しない）
      def measure_strength_fit
        scored = @edges.select { |edge| edge[:strength].to_f.positive? }
        return 0.0 if scored.empty?

        distances = scored.map do |edge|
          from = @by_id[edge[:from]]
          to = @by_id[edge[:to]]
          [ edge[:strength].to_f, Math.hypot(from.center_x - to.center_x, from.center_y - to.center_y) ]
        end
        longest = distances.map(&:last).max
        return 0.0 unless longest&.positive?

        # 強い(1.0)ほど近い(0.0)のが良い。1件ずつの当てはまりを平均する
        distances.sum { |strength, distance| strength * (1.0 - distance / longest) } / distances.size
      end

      # 群れのまとまり。**同じ群れは近く、別の群れとは離れていてほしい**
      def measure_group_cohesion
        members = @groups.filter_map do |group|
          boxes = Array(group[:members]).filter_map { |id| @by_id[id] }
          boxes if boxes.size >= 2
        end
        return 0.0 if members.empty?

        board = board_diagonal
        return 0.0 unless board.positive?

        members.sum { |boxes| 1.0 - (spread(boxes) / board) } / members.size
      end

      def spread(boxes)
        width = boxes.map(&:center_x).minmax.then { |min, max| max - min }
        height = boxes.map(&:center_y).minmax.then { |min, max| max - min }
        Math.hypot(width, height)
      end

      def board_diagonal
        return 0.0 if @boxes.empty?

        width = @boxes.map(&:center_x).minmax.then { |min, max| max - min }
        height = @boxes.map(&:center_y).minmax.then { |min, max| max - min }
        Math.hypot(width, height)
      end

      # 向きの揃い。**同じ向きに読める図は、目で追える。**
      # 親から子へ下る線ばかり／左から右へ進む線ばかり、という状態を良しとする
      def measure_flow(segments)
        return 0.0 if segments.empty?

        downward = segments.count { |a, b| b[1] > a[1] + AXIS_EPSILON }
        rightward = segments.count { |a, b| b[0] > a[0] + AXIS_EPSILON }
        [ downward, rightward ].max.to_f / segments.size
      end

      # ---- 変化の大きさ ------------------------------------------------------

      def count_movement
        @boxes.sum do |box|
          before = @previous[box.id]
          next 0.0 unless before

          Math.hypot(box.x - before[:x], box.y - before[:y])
        end
      end

      def crosses?(p1, p2, p3, p4)
        d1 = cross(p3, p4, p1)
        d2 = cross(p3, p4, p2)
        d3 = cross(p1, p2, p3)
        d4 = cross(p1, p2, p4)
        ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
      end

      def cross(a, b, c)
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      end
    end
  end
end
