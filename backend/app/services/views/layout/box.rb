# frozen_string_literal: true

module Views
  module Layout
    # 置かれるカード1枚。
    #
    # **配置の計算はこの箱の上だけで行う。** DB のレコードを直接動かさないので、
    # 案を何通りか作って比べ、いちばん良いものだけを書き戻せる。
    class Box
      attr_reader :id, :title, :width, :height, :footprint_width
      attr_accessor :x, :y

      def initialize(id:, title:, x:, y:, width:, height:, footprint_width:)
        @id = id
        @title = title
        @x = x.to_f
        @y = y.to_f
        @width = width.to_f
        @height = height.to_f
        # 見出しが長いカードは、実寸より広い場所を空けないと詰まって見える
        @footprint_width = [ @width, footprint_width.to_f ].max
      end

      def center_x = x + width / 2
      def center_y = y + height / 2

      def center_x=(value)
        self.x = value - width / 2
      end

      def center_y=(value)
        self.y = value - height / 2
      end

      # 見出しのはみ出しを含めた、左右に必要な幅
      def left = center_x - footprint_width / 2
      def right = center_x + footprint_width / 2

      # 実際のカードの縁。**見出しのはみ出しは含めない。**
      # 線を引くのは実物の縁からで、読みやすさのための余白からではない
      def left_edge = x
      def right_edge = x + width
      def top = y
      def bottom = y + height

      # 大きさを変える。**見出しの幅は狭めない**
      # （大きくしたカードでも、長い見出しは同じだけ場所が要る）
      def resize(new_width, new_height)
        @width = new_width.to_f.clamp(Metrics::MIN_CARD_SIZE, Metrics::MAX_CARD_SIZE)
        @height = new_height.to_f.clamp(Metrics::MIN_CARD_SIZE, Metrics::MAX_CARD_SIZE)
        @footprint_width = [ @width, @footprint_width ].max
      end

      def dup_at(new_x, new_y)
        self.class.new(id:, title:, x: new_x, y: new_y, width:, height:, footprint_width:)
      end

      def to_placement
        { id: id, x: x.round, y: y.round, width: width.round, height: height.round }
      end
    end
  end
end
