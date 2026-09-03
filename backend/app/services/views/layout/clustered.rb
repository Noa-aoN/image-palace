# frozen_string_literal: true

module Views
  module Layout
    # まとまりごとに島を作って並べる。
    #
    # 「オリュンポスの神々」「ローマの神々」のように、
    # **カードが何組かの群れに分かれている**ときの置き方。
    #
    # 島の中は格子、島どうしも格子。
    # 島の間は、島の中の隙間よりはっきり広く取る——そうしないと、
    # どこまでが1つの群れなのかが目で切れない。
    class Clustered
      # 島どうしの間隔。島の中の隙間の2倍。**ここが群れの境目になる**
      ISLAND_GAP = Metrics::MIN_CARD_GAP * 2

      # @param groups [Array<Hash>] { name:, members: [id] }
      def initialize(boxes:, groups:)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @groups = groups
      end

      def call
        islands = build_islands
        return Grid.new(boxes: @boxes).call if islands.size <= 1

        # 島ごとに中を詰めて、大きさを測る
        laid = islands.map do |members|
          Grid.new(boxes: members).call
          { boxes: members, width: extent(members, :x), height: extent(members, :y) }
        end

        arrange_islands(laid)
        @boxes
      end

      private

      # 島に分ける。**どの島にも入らなかったカードは、最後の島にまとめる。**
      # 落とすと図から消えてしまう
      def build_islands
        assigned = Set.new
        islands = @groups.filter_map do |group|
          members = Array(group[:members] || group["members"])
                    .filter_map { |id| @by_id[id] unless assigned.include?(id) }
          members.each { |box| assigned << box.id }
          members.presence
        end

        rest = @boxes.reject { |box| assigned.include?(box.id) }
        islands << rest if rest.any?
        islands
      end

      def extent(boxes, axis)
        return 0.0 if boxes.empty?

        if axis == :x
          boxes.map(&:right).max - boxes.map(&:left).min
        else
          boxes.map(&:bottom).max - boxes.map(&:top).min
        end
      end

      # 島を格子に置く。行の高さは、その行でいちばん高い島に合わせる
      def arrange_islands(laid)
        columns = Math.sqrt(laid.size).ceil.clamp(1, 4)
        rows = laid.each_slice(columns).to_a
        widths = Array.new(columns) do |index|
          rows.filter_map { |row| row[index]&.fetch(:width) }.max || 0
        end

        y = Metrics::BOARD_PADDING.to_f
        rows.each do |row|
          x = Metrics::BOARD_PADDING.to_f
          row.each_with_index do |island, column_index|
            move_island(island[:boxes], x, y)
            x += widths[column_index] + ISLAND_GAP
          end
          y += row.map { |island| island[:height] }.max + ISLAND_GAP
        end
      end

      def move_island(boxes, to_x, to_y)
        return if boxes.empty?

        dx = to_x - boxes.map(&:left).min
        dy = to_y - boxes.map(&:top).min
        boxes.each do |box|
          box.x += dx
          box.y += dy
        end
      end
    end
  end
end
