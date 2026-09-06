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
      def initialize(boxes:, relations:, score_for:, budget: STANDARD_BUDGET, score: nil, perturb: nil)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        @relations = relations
        @score_for = score_for
        @budget = budget
        # 出来上がった時点の点数。**もう分かっているものを測り直さない**
        # （58枚では1回の採点に0.4秒かかる。測り直すだけで予算の2割が消える）
        @score = score
        # **わざと1手ずらしてから登り直す番号。**
        # 同じ所から登ると毎回同じ頂へ着く。少し崩してから登り直すと、
        # 別の頂へ着くことがある（「念入り」はこれを繰り返す）
        @perturb = perturb
        @tried = 0
        @kept = 0
      end

      # @return [Hash] { boxes:, score:, tried:, kept: }
      def call
        best = @score || @score_for.call(@boxes)
        return finish(best) if @boxes.size < 2 || @budget <= 0

        deadline = now + @budget
        slowest = 0.0
        best = perturb!(best)

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

      # 登り始める前に、わざと1手当てる。**点数が下がってもよい。**
      # 下がった所から登り直すと、元の頂より高い所へ着くことがある
      def perturb!(score)
        return score if @perturb.nil?

        list = moves
        return score if list.empty?

        undo = list[@perturb % list.size].call
        return score if undo.nil?

        @score_for.call(@boxes)
      end

      def now = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      # 当てる手を、**決まった順に**並べる。乱数を使わない。
      #
      # **長い線を縮める手を先に置く。** 交差も曲がりも、たいていは
      # 「遠くへ引かれた線」から出てくる。並べ替えより先に、距離を詰めたほうが効く
      def moves
        levels = detect_levels
        pulls + swaps(levels) + flips + gap_changes(levels) + row_spacing(levels)
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
        @children_of ||= Relation.downward(@relations)
                                   .group_by { |relation| relation[:from] }
                                   .transform_values { |list| list.map { |relation| relation[:to] }.uniq.sort }
                                   .select { |_, children| children.size >= 2 }
      end

      # ---- 手4: 長い線の両端を近づける ---------------------------------------

      # **線を伸ばすより、カードを寄せる。**
      #
      # 遠くへ引かれた線は、途中で他のカードをよけ、他の線と交わり、
      # 曲がりを増やす。**線の側で直そうとしても限界がある**ので、
      # 端のカードを相手のほうへ寄せる。
      #
      # 動かすのは片方だけ。両方を寄せると、それぞれの兄弟との並びが同時に崩れる
      def pulls
        long_edges.map do |edge|
          -> { pull_together!(edge) }
        end
      end

      # 長い順に。**短い線を縮めても図は変わらない**
      def long_edges
        @relations.map do |relation|
          from = @by_id[relation[:from]]
          to = @by_id[relation[:to]]
          next if from.nil? || to.nil?

          [ relation, (from.center_x - to.center_x).abs + (from.center_y - to.center_y).abs ]
        end.compact.select { |_, length| length > LONG_EDGE }
           .sort_by { |relation, length| [ -length, relation[:from], relation[:to] ] }
           .first(MAX_PULLS).map(&:first)
      end

      # これより長ければ「遠い」とみなす
      LONG_EDGE = Metrics::CARD_WIDTH * 5
      # 一度に試す本数。多いと、1手あたりの採点が予算を食う
      MAX_PULLS = 8
      # 1回で詰める割合。一気に寄せると、寄せた先で重なる
      PULL_RATIO = 0.4

      def pull_together!(relation)
        from = @by_id[relation[:from]]
        to = @by_id[relation[:to]]
        return nil if from.nil? || to.nil?

        # 段をまたぐ線は横に、同じ段の線は縦に寄せない（段の意味が壊れる）
        gap = to.center_x - from.center_x
        return nil if gap.abs < Metrics::MIN_CARD_GAP

        # 動かすのは、その段で端に居るほう（真ん中を動かすと兄弟の並びが崩れる）
        mover = outermost(from, to)
        before = mover.center_x
        mover.center_x = before + (mover.equal?(from) ? gap : -gap) * PULL_RATIO
        lambda { mover.center_x = before }
      end

      # その段の端に近いほう。**真ん中のカードは動かさない**
      def outermost(a, b)
        [ a, b ].max_by { |box| (box.center_x - level_center(box)).abs }
      end

      def level_center(box)
        row = @boxes.select { |other| (other.center_y - box.center_y).abs <= LEVEL_EPSILON }
        row.sum(&:center_x) / row.size
      end

      # ---- 手5: 段の間隔をそろえる -------------------------------------------

      # **段の間隔が揃っていないと、世代の重みが違って見える。**
      # 段ごとに一番大きいカードで決めているので、絵の大きいカードが1枚あるだけで
      # その段だけ広くなる。全部の段を、いちばん広い間隔にそろえてみる
      def row_spacing(levels)
        return [] if levels.size < 3

        [ -> { even_out_rows!(levels) } ]
      end

      def even_out_rows!(levels)
        tops = levels.map { |level| level.map(&:top).min }
        gaps = tops.each_cons(2).map { |a, b| b - a }
        return nil if gaps.empty?

        target = gaps.max
        return nil if gaps.all? { |gap| (gap - target).abs < 1 }

        before = @boxes.map { |box| [ box, box.y ] }
        levels.each_with_index do |level, index|
          next if index.zero?

          shift = tops.first + target * index - level.map(&:top).min
          level.each { |box| box.y += shift }
        end
        lambda { before.each { |box, y| box.y = y } }
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
