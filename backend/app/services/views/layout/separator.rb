# frozen_string_literal: true

module Views
  module Layout
    # 重なりを解く。
    #
    # レイアウトが正しく組めていれば重なりは出ない。**ここは最後の保険**で、
    # 「いまの形を活かす」ときや、手で置かれたカードが重なっているときに効く。
    #
    # ## 前の作りとの違い
    #
    # 以前は固定の盤（2400×1600）へ押し込めようとしていた。
    # 必要な中心間距離から逆算すると **8列×4行＝約32枚**が収容の限界で、
    # 33枚目からは「押す → 盤の中へ戻す」の振動になり、
    # 24周まわして**重なったまま黙って終わって**いた。
    #
    # いまは押し戻さない。**足りなければ盤が広がる**（React Flow の面は無限で、
    # 開いたときに全体が入るよう収まる）。だから必ず解ける。
    class Separator
      # 押しのけを繰り返す回数。連鎖して玉突きになるため何度か回す
      PASSES = 24

      # @param movable [Set<String>, nil] 動かしてよい id。nil は全部
      # @param reorigin [Boolean] 全体を左上へ寄せ直すか。
      #   **「いまの形を活かす」ときは寄せない。** 置いた場所が動くのは、
      #   本人が頼んでいない変更になる
      def initialize(boxes:, movable: nil, reorigin: true)
        # **並び順を決めて読む。** 総当りの順が変われば結果も変わる。
        # id 順にすれば、同じ入力からは必ず同じ図になる
        @boxes = boxes.sort_by(&:id)
        @movable = movable
        @reorigin = reorigin
      end

      def call
        PASSES.times do
          collisions = 0
          @boxes.combination(2) do |a, b|
            collisions += 1 if separate!(a, b)
          end
          break if collisions.zero?
        end
        clamp_to_origin! if @reorigin
        @boxes
      end

      private

      # 2枚が近すぎたら、浅いほうの軸へ押し分ける。離せたら true
      def separate!(a, b)
        overlap_x = (a.footprint_width + b.footprint_width) / 2 + Metrics::MIN_CARD_GAP -
                    (a.center_x - b.center_x).abs
        overlap_y = (a.height + b.height) / 2 + Metrics::MIN_CARD_GAP -
                    (a.center_y - b.center_y).abs
        return false if overlap_x <= 0 || overlap_y <= 0

        if overlap_x < overlap_y
          push(a, b, :x, overlap_x)
        else
          push(a, b, :y, overlap_y)
        end
        true
      end

      # 押し分ける。**片方が動かせないなら、動かせるほうを2倍押す**
      def push(a, b, axis, shift)
        a_movable = movable?(a)
        b_movable = movable?(b)
        return if !a_movable && !b_movable

        share = a_movable && b_movable ? shift / 2 : shift
        direction = current(a, axis) <= current(b, axis) ? -1 : 1

        move(a, axis, share * direction) if a_movable
        move(b, axis, share * -direction) if b_movable
      end

      def movable?(box) = @movable.nil? || @movable.include?(box.id)
      def current(box, axis) = axis == :x ? box.center_x : box.center_y

      def move(box, axis, delta)
        axis == :x ? box.x += delta : box.y += delta
      end

      # 押した結果、左や上へはみ出したら全体を寄せ戻す。
      # **1枚だけを戻さない**（戻すとまた重なる）
      def clamp_to_origin!
        return if @boxes.empty?

        dx = Metrics::BOARD_PADDING - @boxes.map(&:left).min
        dy = Metrics::BOARD_PADDING - @boxes.map(&:top).min
        return if dx <= 0 && dy <= 0

        @boxes.each do |box|
          box.x += [ dx, 0 ].max
          box.y += [ dy, 0 ].max
        end
      end
    end
  end
end
