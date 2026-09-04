# frozen_string_literal: true

module Views
  module Layout
    # 図を、**点数が上がる方へ動かす**。
    #
    # ## なぜ要るのか
    #
    # これまでは案を1〜2通り作って良いほうを採るだけだった。
    # 形を選んで整えたときは案が1つしかないので、**比べることすら起きていなかった**。
    # 「良し悪しを数で持つ」までは出来ていて、その数を上げる回路が無かった。
    #
    # ## やり方（山登り）
    #
    # 出来上がった図に**小さな手**を1つ当て、点数が上がったら残し、下がったら戻す。
    # これを時間切れまで繰り返す。総当りで最適解を出すのは現実的でないが、
    # 目に見える崩れは数十手で落ち着く。
    #
    #   ・段の中で隣り合う2枚を入れ替える  … 線の交差が減る
    #   ・部分木を左右に反転する            … 親をまたぐ交差が減る
    #   ・段の間隔を伸ばす／縮める          … 線がカードを横切らなくなる
    #
    # ## 守ること
    #
    # **同じ入力なら同じ結果になること。** 乱数を使わず、手を当てる順を id 順に固定する。
    # 揺れる図は「さっきのほうが良かった」を再現できない。
    #
    # **時間で打ち切ること。** 同期で走るので、待たせすぎない。
    class Improver
      # 使える時間（秒）。利用者が「念入り」を選べば伸びる
      STANDARD_BUDGET = 2.0
      THOROUGH_BUDGET = 8.0

      # 段の間隔を、何倍まで伸縮して試すか
      GAP_SCALES = [ 1.25, 0.8, 1.5 ].freeze
      # 同じ高さとみなす差（段を見つけるのに使う）
      LEVEL_EPSILON = 8.0

      # @param boxes [Array<Box>] 出来上がった配置（この配列を書き換える）
      # @param score_for [Proc] boxes を受け取って Score を返す
      # @param relations [Array<Hash>]
      # @param budget [Float] 使える秒数
      def initialize(boxes:, relations:, score_for:, budget: STANDARD_BUDGET, score: nil)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @relations = relations
        @score_for = score_for
        @budget = budget
        # 出来上がった時点の点数。**もう分かっているものを測り直さない**
        # （58枚では1回の採点に0.4秒かかる。測り直すだけで予算の2割が消える）
        @score = score
        @tried = 0
        @kept = 0
      end

      # @return [Hash] { boxes:, score:, tried:, kept: }
      def call
        best = @score || @score_for.call(@boxes)
        return finish(best) if @boxes.size < 2 || @budget <= 0

        deadline = now + @budget
        slowest = 0.0

        moves.each do |move|
          # **入りきらない手は始めない。** 始めてから時間切れになると、
          # 予算を超えたぶんだけ利用者を待たせることになる
          break if now + slowest > deadline

          @tried += 1
          undo = move.call
          next if undo.nil?

          started = now
          candidate = @score_for.call(@boxes)
          slowest = [ slowest, now - started ].max

          if candidate.points > best.points
            best = candidate
            @kept += 1
          else
            undo.call
          end
        end
        finish(best)
      end

      private

      def finish(score) = { boxes: @boxes, score: score, tried: @tried, kept: @kept }

      def now = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      # 当てる手を、**決まった順に**並べる。乱数を使わない
      def moves
        levels = detect_levels
        swaps(levels) + flips + gap_changes(levels)
      end

      # ---- 段を見つける ------------------------------------------------------

      # 同じ高さのものをひとまとまりにする。上から順に、段の中は左から順に
      def detect_levels
        @boxes.sort_by { |box| [ box.center_y, box.center_x, box.id ] }
              .slice_when { |a, b| (b.center_y - a.center_y).abs > LEVEL_EPSILON }
              .to_a
      end

      # ---- 手1: 段の中で隣り合う2枚を入れ替える ------------------------------

      def swaps(levels)
        levels.flat_map do |level|
          level.each_cons(2).map do |a, b|
            -> { swap!(a, b) }
          end
        end
      end

      # 中心どうしを入れ替える。**幅が違っても中心を交換すれば並びは保たれる**
      def swap!(a, b)
        before = [ a.center_x, b.center_x ]
        a.center_x = before[1]
        b.center_x = before[0]
        lambda {
          a.center_x = before[0]
          b.center_x = before[1]
        }
      end

      # ---- 手2: 部分木を左右に反転する ---------------------------------------

      # 親をまたぐ交差は、子の並びを丸ごと裏返すと解けることがある。
      # 1枚ずつの入れ替えでは、そこへ辿り着くまでに何度も点数が下がるので越えられない
      def flips
        children_of.keys.sort.map do |parent_id|
          -> { flip!(children_of[parent_id]) }
        end
      end

      def flip!(child_ids)
        children = child_ids.filter_map { |id| @by_id[id] }
        return nil if children.size < 2

        centers = children.map(&:center_x)
        mirrored = centers.reverse
        children.each_with_index { |box, index| box.center_x = mirrored[index] }
        lambda {
          children.each_with_index { |box, index| box.center_x = centers[index] }
        }
      end

      def children_of
        @children_of ||= @relations.reject { |relation| relation[:type].to_s == "peer" }
                                   .group_by { |relation| relation[:from] }
                                   .transform_values { |list| list.map { |relation| relation[:to] }.uniq.sort }
                                   .select { |_, children| children.size >= 2 }
      end

      # ---- 手3: 段の間隔を伸縮する -------------------------------------------

      # 線がカードを横切るのは、段が詰まりすぎていることが多い。
      # **1段だけ動かすと下の段との間隔が壊れる**ので、その段より下を丸ごとずらす
      def gap_changes(levels)
        return [] if levels.size < 2

        (1...levels.size).to_a.product(GAP_SCALES).map do |index, scale|
          -> { stretch!(levels, index, scale) }
        end
      end

      def stretch!(levels, index, scale)
        gap = levels[index].first.center_y - levels[index - 1].first.center_y
        shift = gap * (scale - 1)
        return nil if shift.abs < 1

        moved = levels[index..].flatten
        moved.each { |box| box.center_y += shift }
        lambda { moved.each { |box| box.center_y -= shift } }
      end
    end
  end
end
