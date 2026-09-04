# frozen_string_literal: true

module Views
  module Layout
    # 並べて比べる。
    #
    # ## どういう図か
    #
    # 「ギリシャ／ローマ／エジプト」を**列**にして、
    # 「建築様式／文字／政体」を**行**に揃える。
    # 同じ観点のものが横一列に並ぶので、**目を横へ滑らせるだけで違いが読める**。
    #
    # 格子図との違いは、**列に意味がある**こと。格子は詰めて並べるだけで、
    # 何列目に何が来るかに意味は無い。
    #
    # ## 何を列にするか
    #
    # AI が返す「群れ（groups）」をそのまま列にする。
    # 群れは「意味のまとまり」なので、比べる対象の単位とちょうど重なる。
    # **新しく訊き直さずに済む。**
    #
    # 行は、群れの中の並び順で揃える。1列目の2番目と2列目の2番目が
    # 同じ高さに来る——それが「比べられる」ということ。
    class Comparison
      # 列どうしの間隔。行の間隔より広く取って、**列の切れ目を見せる**
      COLUMN_GAP = Metrics::MIN_CARD_GAP * 1.5
      ROW_GAP = Metrics::MIN_CARD_GAP

      # @param groups [Array<Hash>] { name:, members: [id] } — これが列になる
      def initialize(boxes:, groups:)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @groups = groups
      end

      def call
        columns = build_columns
        # 列が1本しか作れないなら、比べる図にならない。格子で並べる
        return Grid.new(boxes: @boxes).call if columns.size < 2

        place!(columns)
        @boxes
      end

      private

      # 群れを列にする。**どの群れにも入らなかったカードは、最後に1列足す**
      # （消さずに、比べる対象からは外して見せる）
      def build_columns
        seen = Set.new
        columns = @groups.filter_map do |group|
          members = Array(group[:members]).filter_map do |id|
            next if seen.include?(id)

            seen << id
            @by_id[id]
          end
          members.presence
        end

        rest = @boxes.reject { |box| seen.include?(box.id) }
        columns << rest if rest.any?
        columns
      end

      # 行の高さは、その行でいちばん高いカードに合わせる。
      # **列ごとに高さを決めると、行が揃わない**（揃わなければ比べられない）
      def place!(columns)
        row_heights = row_heights_for(columns)
        widths = columns.map { |column| column.map(&:footprint_width).max || Metrics::CARD_WIDTH }

        x = Metrics::BOARD_PADDING.to_f
        columns.each_with_index do |column, index|
          y = Metrics::BOARD_PADDING.to_f
          column.each_with_index do |box, row|
            box.center_x = x + widths[index] / 2
            box.y = y
            y += row_heights[row] + ROW_GAP
          end
          x += widths[index] + COLUMN_GAP
        end
      end

      def row_heights_for(columns)
        rows = columns.map(&:size).max.to_i
        Array.new(rows) do |row|
          columns.filter_map { |column| column[row]&.height }.max || Metrics::CARD_HEIGHT
        end
      end
    end
  end
end
