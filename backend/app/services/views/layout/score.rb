# frozen_string_literal: true

module Views
  module Layout
    # 出来上がった図の質を、**判断基準に沿って点数にする**。
    #
    # ## なぜ点数で持つのか
    #
    # 良し悪しを言葉で持っていると、案を比べられない。数で持てば
    #   ・案を何通りか作って比べられる
    #   ・良くなる方へ動かせる（Improver）
    #   ・良くなったのか悪くなったのかをテストで固定できる
    #   ・「線の交差が3か所残りました」と利用者に言える
    #
    # ## 判断基準（100点・4群14項目）
    #
    #   A 意味の正しさ 30 … 関係そのものを見る（幾何は見ない）
    #   B 読みやすさ   30 … **実際に引かれる経路と、実際に置かれる文字**で測る
    #   C 図の作法     25 … 参考図（家系図・相関図）が持っている作法
    #   D 手の入れ具合 15 … 元の図をどれだけ動かしたか
    #
    # ## 実物で測る
    #
    # 以前は線を「両端を結ぶ直線」として見ていた。だが実際に描かれるのは
    # `Router` が引く直交の折れ線で、文字は `LabelPlacement` が置く。
    # **測っている図と目に見える図が別物**だったので、交差の数を減らしても
    # 実際の交差は減らなかった。いまは `Geometry` が組んだ実物を測る。
    class Score
      # 配点。**ここが判断基準の本体**。重みを変えたければここだけを見る
      ITEMS = [
        { key: :no_contradiction, group: :semantics, points: 10, label: "矛盾が無い" },
        { key: :direction, group: :semantics, points: 6, label: "向きが正しい" },
        { key: :acyclic, group: :semantics, points: 4, label: "輪になっていない" },
        { key: :connectedness, group: :semantics, points: 3, label: "孤立が少ない" },
        # **強い関係を持つのに浮いているのが、いちばん困る。**
        # 「関係が無いから浮いている」のと、「関係があるのに浮いている」のは別のこと
        { key: :strong_connected, group: :semantics, points: 3, label: "強い関係のカードが繋がっている" },
        { key: :specific_types, group: :semantics, points: 4, label: "種別が具体的" },

        { key: :no_overlap, group: :legibility, points: 10, label: "カードが重ならない" },
        { key: :edge_card_clear, group: :legibility, points: 7, label: "線がカードを横切らない" },
        { key: :few_crossings, group: :legibility, points: 5, label: "線どうしの交差が少ない" },
        { key: :label_readable, group: :legibility, points: 4, label: "線の文字が読める" },
        # **長い線に罰を与える。** 罰が無かったので、盤の端から端まで走る線が放置されていた
        { key: :short_edges, group: :legibility, points: 4, label: "線が長すぎない" },

        { key: :few_bends, group: :convention, points: 5, label: "線の曲がりが少ない" },
        { key: :parent_centered, group: :convention, points: 5, label: "親が子の中央に来る" },
        { key: :couple_bus, group: :convention, points: 4, label: "夫婦が隣り合い、子が間から降りる" },
        { key: :level_aligned, group: :convention, points: 3, label: "同列が同じ高さにある" },
        { key: :flow_consistent, group: :convention, points: 3, label: "流れの向きが揃う" },
        # **子が親より上にあってはいけない。** 段の意味そのものが壊れる
        { key: :hierarchy_kept, group: :convention, points: 5, label: "子が親より下にある" },

        { key: :stability, group: :stability, points: 8, label: "元の位置から動かしすぎない" },
        { key: :group_cohesion, group: :stability, points: 7, label: "群れがまとまっている" }
      ].freeze

      GROUPS = {
        semantics: "意味の正しさ",
        legibility: "読みやすさ",
        convention: "図の作法",
        stability: "手の入れ具合"
      }.freeze

      # 交差はゼロを求めない。**ある程度は避けられない**ので、
      # 線の本数に対する割合で見る（1本あたり0.5回で0点）
      CROSSINGS_PER_EDGE_FOR_ZERO = 0.5
      # 曲がりは1本あたり3回で0点。参考図はどれも0〜2回
      BENDS_PER_EDGE_FOR_ZERO = 3.0
      # 親の中心と子の中点のずれ。カード1枚ぶんずれたら0点
      CENTERING_TOLERANCE = Metrics::CARD_WIDTH.to_f
      # 同じ高さとみなす差
      LEVEL_EPSILON = 8.0
      # 向きが揃っているとみなす差
      AXIS_EPSILON = 8.0
      # 動いた量。盤の対角線ぶん動いたら0点
      MOVEMENT_SCALE = 2000.0

      attr_reader :ratios, :counts

      # @param boxes [Array<Box>] 置き終わったカード
      # @param edges [Array<Hash>] { from:, to:, type:, label:, strength: }
      # @param lines [Array<Geometry::Line>, nil] 実際に引かれる線。無ければ B 群は直線で近似
      # @param issues [Array<Consistency::Issue>] 見つかっている食い違い
      def initialize(boxes:, edges:, previous: {}, move_weight: 1.0, groups: [], lines: nil, issues: [])
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        # **線と関係を、同じ絞り込みで揃える。**
        #
        # 関係だけを絞って線をそのまま持っていたので、盤に無いカードを指す関係が
        # 1つあるだけで**並びがずれ**、別の線の交差を数えたり、落ちたりしていた。
        # 同じ番号で引ける、という前提が崩れていた
        kept = edges.each_index.select do |index|
          edge = edges[index]
          @by_id.key?(edge[:from]) && @by_id.key?(edge[:to])
        end
        @edges = kept.map { |index| edges[index] }
        @previous = previous
        @move_weight = move_weight
        @groups = groups
        @lines = lines && kept.map { |index| lines[index] }.compact
        @issues = issues
        measure!
      end

      # 100点満点。**大きいほど良い**
      def points
        ITEMS.sum { |item| item[:points] * ratios.fetch(item[:key], 0.0) }.round
      end

      # 群ごとの点数。利用者に見せる内訳
      def breakdown
        GROUPS.map do |group, label|
          items = ITEMS.select { |item| item[:group] == group }
          {
            group: group, label: label,
            points: items.sum { |item| item[:points] * ratios.fetch(item[:key], 0.0) }.round,
            max: items.sum { |item| item[:points] },
            # **満点でない項目だけ**並べる（読むべきものだけ残す）
            weak: items.reject { |item| ratios.fetch(item[:key], 0.0) >= 0.999 }
                       .sort_by { |item| ratios.fetch(item[:key], 0.0) }
                       .map { |item| { label: item[:label], note: note_for(item[:key]) } }
          }
        end
      end

      # 候補を比べるための値。**小さいほど良い**（既存の呼び出しと向きを揃える）
      def penalty = 100 - points

      # 利用者に伝える一言。**良かったことは言わない**
      def notes
        remarks = []
        remarks << "カードが#{counts[:overlaps]}か所で重なっています" if counts[:overlaps].positive?
        if counts[:edge_card_crossings].positive?
          remarks << "線が#{counts[:edge_card_crossings]}か所でカードを横切っています"
        end
        remarks << "線の文字が#{counts[:label_clashes]}か所で重なっています" if counts[:label_clashes].positive?
        remarks << "線が#{counts[:edge_crossings]}か所で交わっています" if counts[:edge_crossings] > 2
        if counts[:hierarchy_violations].to_i.positive?
          remarks << "子が親より上にあるところが#{counts[:hierarchy_violations]}か所あります"
        end
        remarks
      end

      def to_h
        { points: points, breakdown: breakdown, counts: counts,
          ratios: ratios.transform_values { |value| value.round(3) } }
      end

      # 既存の呼び出しが見ている数（spec と notes で使う）
      def overlaps = counts[:overlaps]
      def edge_card_crossings = counts[:edge_card_crossings]
      def edge_crossings = counts[:edge_crossings]
      def label_clashes = counts[:label_clashes]

      # 項目ごとの、崩れているところの一言。**数が言えるものだけ言う**
      def note_for(key)
        case key
        when :no_contradiction then count_note(:contradictions, "件の食い違い")
        when :direction then count_note(:direction_conflicts, "件の向きの矛盾")
        when :acyclic then count_note(:cycles, "件の輪")
        when :connectedness then count_note(:isolated, "枚が線に繋がっていない")
        when :specific_types then count_note(:vague_types, "本が「その他」のまま")
        when :no_overlap then count_note(:overlaps, "か所でカードが重なる")
        when :edge_card_clear then count_note(:edge_card_crossings, "か所で線がカードを横切る")
        when :few_crossings then count_note(:edge_crossings, "か所で線が交わる")
        when :label_readable then count_note(:label_clashes, "か所で文字が読みにくい")
        when :few_bends then count_note(:bends, "回の曲がり")
        when :short_edges then count_note(:total_edge_length, "の長さ")
        when :hierarchy_kept then count_note(:hierarchy_violations, "か所で子が親より上")
        when :strong_connected then count_note(:isolated_with_strong, "枚が、関係があるのに浮いている")
        end
      end

      private

      def count_note(key, suffix)
        count = counts[key].to_i
        count.positive? ? "#{count}#{suffix}" : nil
      end

      def measure!
        @counts = {}
        @ratios = {}
        measure_semantics!
        measure_legibility!
        measure_convention!
        measure_stability!
      end

      # ---- A 意味の正しさ ----------------------------------------------------

      def measure_semantics!
        by_kind = @issues.group_by(&:kind)
        @counts[:contradictions] = (by_kind["label_conflict"].to_a + by_kind["duplicate_pair"].to_a).size
        @counts[:direction_conflicts] = by_kind["directed_conflict"].to_a.size
        @counts[:cycles] = by_kind["cycle"].to_a.size
        @counts[:isolated] = isolated_count
        @counts[:isolated_with_strong] = isolated_with_strong_count
        @counts[:vague_types] = @edges.count { |edge| edge[:type].to_s == "related" }

        # 食い違いは**1件でも重い**。線の本数に対する割合ではなく、件数で減らす
        @ratios[:no_contradiction] = decay(@counts[:contradictions], 2.0)
        @ratios[:direction] = decay(@counts[:direction_conflicts], 2.0)
        @ratios[:acyclic] = decay(@counts[:cycles], 1.0)
        @ratios[:connectedness] = @boxes.empty? ? 1.0 : 1.0 - @counts[:isolated].to_f / @boxes.size
        # **1枚でも重い。** 関係があるのに浮いているのは、見落としそのもの
        @ratios[:strong_connected] = decay(@counts[:isolated_with_strong], 1.0)
        @ratios[:specific_types] = @edges.empty? ? 1.0 : 1.0 - @counts[:vague_types].to_f / @edges.size
      end

      def isolated_count
        connected = @edges.flat_map { |edge| [ edge[:from], edge[:to] ] }.to_set
        @boxes.count { |box| !connected.include?(box.id) }
      end

      # 強い関係を持つのに、線が1本も引かれていないカード。
      #
      # **「関係が無いから浮いている」のと「関係があるのに浮いている」のは別のこと。**
      # 前者は正しい図で、後者は見落とし。同じ数え方にすると、
      # 関係の無いカードを盤に置いただけで点が下がることになる
      STRONG_ENOUGH = 0.6

      def isolated_with_strong_count
        strong = @edges.select { |edge| edge[:strength].to_f >= STRONG_ENOUGH }
        return 0 if strong.empty?

        connected = @edges.flat_map { |edge| [ edge[:from], edge[:to] ] }.to_set
        named = strong.flat_map { |edge| [ edge[:from], edge[:to] ] }.to_set
        @boxes.count { |box| named.include?(box.id) && !connected.include?(box.id) }
      end

      # ---- B 読みやすさ ------------------------------------------------------

      def measure_legibility!
        @counts[:overlaps] = count_overlaps
        @counts[:edge_card_crossings] = count_edge_card_crossings
        @counts[:edge_crossings] = count_edge_crossings
        @counts[:label_clashes] = count_label_clashes

        # 重なりは1つでもあれば大きく落とす（0でなければほぼ失格）
        @ratios[:no_overlap] = @counts[:overlaps].zero? ? 1.0 : 0.0
        @ratios[:edge_card_clear] = decay(@counts[:edge_card_crossings], 3.0)
        @ratios[:few_crossings] = per_edge_ratio(@counts[:edge_crossings], CROSSINGS_PER_EDGE_FOR_ZERO)
        @ratios[:label_readable] = decay(@counts[:label_clashes], 3.0)
        @ratios[:short_edges] = measure_edge_length
      end

      def count_overlaps
        @boxes.combination(2).count do |a, b|
          (a.center_x - b.center_x).abs < (a.footprint_width + b.footprint_width) / 2 &&
            (a.center_y - b.center_y).abs < (a.height + b.height) / 2
        end
      end

      # 実際に引かれる折れ線の各区間を、全カードに当てる
      def count_edge_card_crossings
        polylines.each_with_index.sum do |polyline, index|
          edge = @edges[index]
          next 0 if polyline.size < 2

          @boxes.count do |box|
            next false if [ edge[:from], edge[:to] ].include?(box.id)

            polyline.each_cons(2).any? { |a, b| segment_hits_box?(a, b, box) }
          end
        end
      end

      def segment_hits_box?(a, b, box)
        return false unless overlaps?(a[:x], b[:x], box.left_edge, box.right_edge)

        overlaps?(a[:y], b[:y], box.top, box.bottom)
      end

      def overlaps?(a1, a2, b1, b2)
        [ a1, a2 ].min < b2 && [ a1, a2 ].max > b1
      end

      # 線どうしの交わり。**同じカードから出ている線は数えない**（必ず寄るため）
      def count_edge_crossings
        indexed = polylines.each_with_index.to_a
        indexed.combination(2).count do |(a, i), (b, j)|
          next false if shares_end?(@edges[i], @edges[j])

          crossing_points(a, b).any?
        end
      end

      # 直交で組んであるので、縦と横の区間の交わりだけを見る
      def crossing_points(a, b)
        found = []
        a.each_cons(2) do |a1, a2|
          b.each_cons(2) do |b1, b2|
            point = orthogonal_crossing(a1, a2, b1, b2)
            found << point if point
          end
        end
        found
      end

      def orthogonal_crossing(a1, a2, b1, b2)
        a_horizontal = (a1[:y] - a2[:y]).abs < 1
        b_horizontal = (b1[:y] - b2[:y]).abs < 1
        return nil if a_horizontal == b_horizontal

        horizontal, vertical = a_horizontal ? [ [ a1, a2 ], [ b1, b2 ] ] : [ [ b1, b2 ], [ a1, a2 ] ]
        x = vertical.first[:x]
        y = horizontal.first[:y]
        return nil unless between?(x, horizontal[0][:x], horizontal[1][:x])
        return nil unless between?(y, vertical[0][:y], vertical[1][:y])

        { x: x, y: y }
      end

      def between?(value, a, b) = value > [ a, b ].min && value < [ a, b ].max

      def shares_end?(a, b)
        [ a[:from], a[:to] ].intersect?([ b[:from], b[:to] ])
      end

      # 文字が読めるか。**他の文字・他の線・カードに被っていないか**
      def count_label_clashes
        rects = label_rects
        clashes = rects.combination(2).count { |a, b| rects_overlap?(a, b) }
        clashes + rects.count { |rect| @boxes.any? { |box| rect_hits_box?(rect, box) } }
      end

      def rects_overlap?(a, b)
        [ a[:right], b[:right] ].min > [ a[:left], b[:left] ].max &&
          [ a[:bottom], b[:bottom] ].min > [ a[:top], b[:top] ].max
      end

      def rect_hits_box?(rect, box)
        rects_overlap?(rect, { left: box.left_edge, right: box.right_edge, top: box.top, bottom: box.bottom })
      end

      # ---- C 図の作法 --------------------------------------------------------

      def measure_convention!
        @counts[:bends] = visible_corners
        @ratios[:few_bends] = per_edge_ratio(@counts[:bends], BENDS_PER_EDGE_FOR_ZERO)
        @ratios[:parent_centered] = measure_centering
        @ratios[:couple_bus] = measure_couple_bus
        @ratios[:level_aligned] = measure_level_alignment
        @ratios[:flow_consistent] = measure_flow
        @ratios[:hierarchy_kept] = measure_hierarchy
      end

      # 線の長さ。**1本あたりの長さで見る**（本数が増えただけで下がらないように）。
      #
      # 罰が無かったので、盤の端から端まで走る線が放置されていた。
      # カード5枚ぶん離れたら0点にする（それ以上は、置き場所が間違っている）
      LENGTH_PER_EDGE_FOR_ZERO = Metrics::CARD_WIDTH * 8.0

      def measure_edge_length
        return 1.0 if polylines.empty?

        # **見えている線の長さを測る。**
        #
        # 1本ずつ足していた頃は、幹を共有する区間を本数ぶん重ねて数えていた
        # （角のときと同じ間違い）。同じ道を3本が通っていても、
        # 見ている人が目で追う長さは1本ぶん。
        # 束ねるほど長さが増える、という逆さまな物差しになっていた
        @counts[:total_edge_length] = unique_segments.sum do |segment|
          (segment[:from][0] - segment[:to][0]).abs + (segment[:from][1] - segment[:to][1]).abs
        end
        average = @counts[:total_edge_length].to_f / polylines.size
        [ 1.0 - average / LENGTH_PER_EDGE_FOR_ZERO, 0.0 ].max
      end

      # 子が親より下にあるか。**段の意味そのもの**なので、崩れたら大きく落とす
      def measure_hierarchy
        directed = Relation.hierarchical(@edges)
        return 1.0 if directed.empty?

        @counts[:hierarchy_violations] = directed.count do |edge|
          from = @by_id[edge[:from]]
          to = @by_id[edge[:to]]
          from && to && to.center_y <= from.center_y
        end
        1.0 - @counts[:hierarchy_violations].to_f / directed.size
      end

      # 親が子たちの真ん中の上に来ているか
      def measure_centering
        # **夫婦は外す。** 二人の中ほどに幹が立つので、
        # 親そのものは子の真ん中に来ない（来たら夫婦が重なる）。
        # 夫婦の作法は couple_bus のほうで測っている
        paired = detect_couples.flat_map { |(a, b), _| [ a, b ] }.to_set
        parents = hierarchy_children.reject { |parent_id, _| paired.include?(parent_id) }
        return 1.0 if parents.empty?

        fits = parents.map do |parent_id, child_ids|
          parent = @by_id[parent_id]
          children = child_ids.filter_map { |id| @by_id[id] }
          next 1.0 if children.size < 2

          middle = children.map(&:center_x).minmax.sum / 2.0
          [ 1.0 - (parent.center_x - middle).abs / CENTERING_TOLERANCE, 0.0 ].max
        end
        fits.sum / fits.size
      end

      # 夫婦が隣り合い、子が二人の間から降りているか。
      # **バスの経路は Router がまだ組まない**ので、いまは隣り合いだけが取れる
      def measure_couple_bus
        couples = detect_couples
        return 1.0 if couples.empty?

        halves = couples.map do |(a_id, b_id), _children|
          a = @by_id[a_id]
          b = @by_id[b_id]
          adjacent = adjacent?(a, b) ? 1.0 : 0.0
          (adjacent + bus_ratio(a, b)) / 2
        end
        halves.sum / halves.size
      end

      # 同列で結ばれた2枚が、共通の子を持つ組
      def detect_couples
        children = hierarchy_children
        peers = Relation.same_level(@edges)
        peers.filter_map do |edge|
          shared = children[edge[:from]].to_a & children[edge[:to]].to_a
          next if shared.empty?

          [ [ edge[:from], edge[:to] ], shared ]
        end
      end

      # 隣り合っている＝同じ高さで、間に他のカードが挟まっていない
      def adjacent?(a, b)
        return false if a.nil? || b.nil?
        return false if (a.center_y - b.center_y).abs > LEVEL_EPSILON

        low, high = [ a.center_x, b.center_x ].minmax
        @boxes.none? do |box|
          next false if [ a.id, b.id ].include?(box.id)

          box.center_x > low && box.center_x < high && (box.center_y - a.center_y).abs <= LEVEL_EPSILON
        end
      end

      # 二人の間から降りているか。子への線が、二人の中点の近くを通っているかで見る
      def bus_ratio(a, b)
        return 0.0 if a.nil? || b.nil?

        middle = (a.center_x + b.center_x) / 2
        trunk = polylines.count do |polyline|
          polyline.each_cons(2).any? do |p, q|
            (p[:x] - q[:x]).abs < 1 && (p[:x] - middle).abs <= LEVEL_EPSILON
          end
        end
        trunk.positive? ? 1.0 : 0.0
      end

      # 同列の関係が同じ高さにあるか（世代の帯）
      def measure_level_alignment
        peers = Relation.same_level(@edges)
        return 1.0 if peers.empty?

        aligned = peers.count do |edge|
          a = @by_id[edge[:from]]
          b = @by_id[edge[:to]]
          a && b && (a.center_y - b.center_y).abs <= LEVEL_EPSILON
        end
        aligned.to_f / peers.size
      end

      # 向きの揃い。**同じ向きに読める図は、目で追える**
      def measure_flow
        directed = Relation.hierarchical(@edges)
        return 1.0 if directed.empty?

        downward = directed.count { |edge| moved(edge, :center_y).positive? }
        rightward = directed.count { |edge| moved(edge, :center_x).positive? }
        [ downward, rightward ].max.to_f / directed.size
      end

      def moved(edge, axis)
        from = @by_id[edge[:from]]
        to = @by_id[edge[:to]]
        return 0.0 if from.nil? || to.nil?

        delta = to.public_send(axis) - from.public_send(axis)
        delta.abs < AXIS_EPSILON ? 0.0 : delta
      end

      # ---- D 手の入れ具合 ----------------------------------------------------

      def measure_stability!
        @counts[:movement] = count_movement.round
        scale = MOVEMENT_SCALE * [ @move_weight, 0.1 ].max
        average = @boxes.empty? ? 0.0 : @counts[:movement].to_f / @boxes.size
        @ratios[:stability] = [ 1.0 - average / scale, 0.0 ].max
        @ratios[:group_cohesion] = measure_group_cohesion
      end

      def count_movement
        @boxes.sum do |box|
          before = @previous[box.id]
          next 0.0 unless before

          Math.hypot(box.x - before[:x], box.y - before[:y])
        end
      end

      # 群れのまとまり。**同じ群れは近く、別の群れとは離れていてほしい**
      def measure_group_cohesion
        members = @groups.filter_map do |group|
          boxes = Array(group[:members]).filter_map { |id| @by_id[id] }
          boxes if boxes.size >= 2
        end
        return 1.0 if members.empty?

        board = board_diagonal
        return 1.0 unless board.positive?

        members.sum { |boxes| [ 1.0 - (spread(boxes) / board), 0.0 ].max } / members.size
      end

      def spread(boxes)
        width = boxes.map(&:center_x).minmax.then { |min, max| max - min }
        height = boxes.map(&:center_y).minmax.then { |min, max| max - min }
        Math.hypot(width, height)
      end

      def board_diagonal
        return 0.0 if @boxes.empty?

        width = @boxes.map(&:center_x).minmax.then { |min, max| max - min }
        height = @boxes.map(&:center_y).minmax.then { |min, max| max - min }
        Math.hypot(width, height)
      end

      # ---- 下ごしらえ --------------------------------------------------------

      # 段を作る関係（同列を除く）の親子表
      def hierarchy_children
        @hierarchy_children ||= Relation.hierarchical(@edges)
                                      .group_by { |edge| edge[:from] }
                                      .transform_values { |list| list.map { |edge| edge[:to] } }
      end

      # 実際に引かれる折れ線。無ければ両端を結ぶ直線で近似する
      # **目に見える角の数。**
      #
      # 1本ずつ数えていた頃は、幹を共有する線の角を本数ぶん重ねて数えていた。
      # 夫婦から3人の子への線なら、同じ幹の角を6回ぶん数えることになる。
      # **見ている人には1つの角**なので、そこは1つと数える。
      #
      # 角＝向きの違う2本の区間が出会う点。同じ場所に何本集まっていても1つ
      def visible_corners
        by_point = Hash.new { |hash, key| hash[key] = Set.new }
        unique_segments.each do |segment|
          by_point[segment[:from]] << segment[:axis]
          by_point[segment[:to]] << segment[:axis]
        end
        by_point.count { |_, axes| axes.size > 1 }
      end

      # 重なっている区間は1つにまとめる（同じ道を何本通っていても、見えるのは1本）
      def unique_segments
        @unique_segments ||= polylines.flat_map { |polyline|
          polyline.each_cons(2).filter_map { |a, b| segment_between(a, b) }
        }.uniq { |segment| [ segment[:from], segment[:to] ] }
      end

      def segment_between(a, b)
        from = [ a[:x].round, a[:y].round ]
        to = [ b[:x].round, b[:y].round ]
        return nil if from == to

        axis = from[0] == to[0] ? :vertical : :horizontal
        # 向きを揃えて持つ（同じ区間を逆から通っても、同じものとして数える）
        from, to = to, from if (to <=> from) == -1
        { from:, to:, axis: }
      end

      # 見えている線。**重なっているものは1本**
      def distinct_polylines
        @distinct_polylines ||= polylines.uniq { |polyline| polyline.map { |p| [ p[:x].round, p[:y].round ] } }
      end

      def polylines
        @polylines ||= if @lines
          @lines.map { |line| line.polyline }
        else
          @edges.map do |edge|
            from = @by_id[edge[:from]]
            to = @by_id[edge[:to]]
            [ { x: from.center_x, y: from.center_y }, { x: to.center_x, y: to.center_y } ]
          end
        end
      end

      def label_rects
        @label_rects ||= @lines ? @lines.filter_map(&:label_rect) : []
      end

      # 件数から割合へ。**1件でも重いもの**に使う（半減する件数を渡す）
      def decay(count, half_life)
        return 1.0 if count.zero?

        0.5**(count / half_life.to_f)
      end

      # 線の本数あたりの件数から割合へ
      def per_edge_ratio(count, per_edge_for_zero)
        return 1.0 if @edges.empty? || count.zero?

        limit = @edges.size * per_edge_for_zero
        return 0.0 unless limit.positive?

        [ 1.0 - count / limit, 0.0 ].max
      end
    end
  end
end
