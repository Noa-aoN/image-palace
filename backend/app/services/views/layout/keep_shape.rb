# frozen_string_literal: true

module Views
  module Layout
    # いまの形を活かす。
    #
    # 置き直すのではなく、**いまの位置を出発点にして、悪いところだけ直す**。
    # 「だいたい良いのに一部だけ重なっている」ときに、全部を並べ直すと
    # 見慣れた形が失われる。
    #
    # ここでやるのは、重なりを解くことと、盤の中へ収めることだけ。
    class KeepShape
      # @param movable [Set<String>, nil] 動かしてよい id。nil は全部
      def initialize(boxes:, movable: nil)
        @boxes = boxes
        @movable = movable
      end

      def call
        # **寄せ直さない。** 置いた場所が動くのは、本人が頼んでいない変更になる
        Separator.new(boxes: @boxes, movable: @movable, reorigin: false).call
        @boxes
      end
    end
  end
end
