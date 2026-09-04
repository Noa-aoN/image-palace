# frozen_string_literal: true

module Views
  module Layout
    # カードの辺の、どこに線が付くか。
    #
    # ## なぜ3点にしたか
    #
    # 辺の**真ん中に1点だけ**だった。手で線を引くと、どの相手へ向かう線も
    # 同じ点から出るので、つながりが増えるほど根元が束になって読めなくなる。
    # AI が引く線には「ポート」（辺の中心からのずれ）を配って散らしていたが、
    # **手で引く線には、掴める点そのものが1つしか無かった**。
    #
    # 辺ごとに3点。**5点は多すぎた**——狙う的が小さくなり、
    # どれを選んだのか自分でも分からなくなる。
    # 真ん中を含めた奇数にすることで、「真ん中から出したい」がそのまま選べる。
    #
    # ## 名前の付け方
    #
    #   "top"    … 真ん中（**昔からのデータはこの形**。読めなくならないよう残す）
    #   "top-0"  … 左寄り
    #   "top-1"  … 真ん中（"top" と同じ位置）
    #   "top-2"  … 右寄り
    #
    # 位置は (index + 1) / 4。端に寄せすぎると角から線が出て、
    # どちらの辺の線か読めなくなる。
    module Handles
      SIDES = %w[top bottom left right].freeze
      # 1辺あたりの点の数。奇数にすると真ん中が選べる
      POINTS = 3
      # 真ん中の番号。**昔からの名前（"top"）と同じ位置**
      CENTER = 1
      DEFAULT_SIDE = "bottom"

      module_function

      # どの辺か。"top-3" → "top"、"top" → "top"
      def side(handle)
        name = handle.to_s.split("-").first
        SIDES.include?(name) ? name : DEFAULT_SIDE
      end

      # 辺のどこか（0..1）。番号が無ければ真ん中
      def fraction(handle)
        index = handle.to_s.split("-")[1]
        return 0.5 if index.blank?

        (index.to_i.clamp(0, POINTS - 1) + 1) / (POINTS + 1).to_f
      end

      # 番号から名前へ。真ん中だけは昔からの名前を使う
      def name(side_name, index)
        index == CENTER ? side_name : "#{side_name}-#{index}"
      end

      # 線が出入りする点。offset は辺に沿ったずれ（AI が配るポート）
      def point(box, handle, offset = 0)
        t = fraction(handle)
        case side(handle)
        when "top" then { x: box.left_edge + box.width * t + offset, y: box.top }
        when "bottom" then { x: box.left_edge + box.width * t + offset, y: box.bottom }
        when "right" then { x: box.right_edge, y: box.top + box.height * t + offset }
        else { x: box.left_edge, y: box.top + box.height * t + offset }
        end
      end

      # 辺から外へ向かう向き
      def outward(handle)
        case side(handle)
        when "top" then { x: 0, y: -1 }
        when "bottom" then { x: 0, y: 1 }
        when "right" then { x: 1, y: 0 }
        else { x: -1, y: 0 }
        end
      end

      # 辺に沿った向きか（縦の辺＝左右）
      def horizontal_side?(handle) = %w[left right].include?(side(handle))

      # その辺で、ポートを配れる幅
      def span(box, handle) = horizontal_side?(handle) ? box.height : box.width
    end
  end
end
