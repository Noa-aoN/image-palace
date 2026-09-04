# frozen_string_literal: true

module Views
  module Layout
    # **近いものを、揃える。**
    #
    # ## なぜ要るのか
    #
    # 段に並べる仕組みは「親を子の中ほどへ」「兄弟を詰めて」と置くので、
    # 段どうしの縦の通りは誰も見ていない。結果、
    #
    #     ゼウス   x=771
    #       アテナ x=736     ← 35px だけずれている
    #
    # のように、**揃えるつもりだったものが少しだけずれる**。
    # 目には「雑に置かれている」と映るし、線も真下へ降りられず余計に曲がる。
    #
    # ## どう揃えるか
    #
    # 中心が近いものをひとまとまりにして、その平均へ寄せる。
    # **同じ段のものは揃えない**（同じ高さで同じ横位置にしたら重なる）。
    #
    # 寄せる幅には上限を置く。遠いものまで引き寄せると、
    # 「近いから揃えた」ではなく「並びを作り直した」ことになる。
    class Align
      # これだけ近ければ「揃えるつもりだった」とみなす
      TOLERANCE = 56.0
      # 1枚を動かす上限。これを超えるなら、揃えるより今の場所のほうが正しい
      MAX_SHIFT = 40.0
      # 同じ段とみなす縦の差
      SAME_ROW = 8.0

      def initialize(boxes:)
        @boxes = boxes
      end

      def call
        return @boxes if @boxes.size < 2

        columns.each { |group| snap!(group) }
        @boxes
      end

      private

      # 中心の近いものをひとまとまりにする。**段が同じものは同じ組に入れない**
      def columns
        sorted = @boxes.sort_by { |box| [ box.center_x, box.id ] }
        groups = []
        current = []

        sorted.each do |box|
          if current.empty? || joinable?(current, box)
            current << box
          else
            groups << current
            current = [ box ]
          end
        end
        groups << current
        groups.select { |group| group.size >= 2 }
      end

      # 組に入れてよいか。近いこと、そして**同じ段の相手が居ないこと**
      def joinable?(current, box)
        return false if (box.center_x - current.first.center_x).abs > TOLERANCE

        current.none? { |other| (other.center_y - box.center_y).abs < SAME_ROW }
      end

      # 組の平均へ寄せる。**遠いものは置いていく**（無理に引き寄せない）
      def snap!(group)
        target = group.sum(&:center_x) / group.size
        group.each do |box|
          shift = target - box.center_x
          next if shift.abs > MAX_SHIFT

          box.center_x = target
        end
      end
    end
  end
end
