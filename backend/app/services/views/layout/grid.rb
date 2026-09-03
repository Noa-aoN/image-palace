# frozen_string_literal: true

module Views
  module Layout
    # 格子に並べる。
    #
    # 関係が無い（または関係で並べたくない）ときの置き方。
    # **列の幅は、その列でいちばん広いカードに合わせる。**
    # 一律の幅で切ると、長い見出しのカードだけが隣へはみ出す。
    class Grid
      def initialize(boxes:, columns: nil)
        @boxes = boxes
        @columns = columns
      end

      def call
        return @boxes if @boxes.empty?

        columns = @columns || default_columns
        rows = @boxes.each_slice(columns).to_a

        # 列の幅・行の高さを先に決める（あとで動かさなくて済む）
        widths = column_widths(rows, columns)
        heights = rows.map { |row| row.map(&:height).max }

        y = Metrics::BOARD_PADDING.to_f
        rows.each_with_index do |row, row_index|
          x = Metrics::BOARD_PADDING.to_f
          row.each_with_index do |box, column_index|
            box.center_x = x + widths[column_index] / 2
            box.y = y
            x += widths[column_index] + Metrics::MIN_CARD_GAP
          end
          y += heights[row_index] + Metrics::MIN_CARD_GAP
        end
        @boxes
      end

      private

      # おおよそ正方形に近づける。横に長すぎる帯にも、縦に細長い列にもしない
      def default_columns
        Math.sqrt(@boxes.size).ceil.clamp(1, 12)
      end

      def column_widths(rows, columns)
        Array.new(columns) do |index|
          rows.filter_map { |row| row[index]&.footprint_width }.max || Metrics::CARD_WIDTH
        end
      end
    end
  end
end
