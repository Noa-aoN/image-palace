# frozen_string_literal: true

module Views
  module Layout
    # 階層に並べる。親を上、子をその下へ。
    #
    # ## なぜコードで解くのか
    #
    # これまでは「親は子の真ん中の上に置け」と日本語で AI に頼んでいた。
    # 守られるかは運任せで、守られても後段の押しのけが崩していた。
    #
    # 家系図が家系図に見えるかどうかは、**3つの決めごとを全部守れるか**で決まる。
    # どれも算数なので、AI に頼むより解いたほうが確実で、速く、毎回同じ結果になる。
    #
    #   1. 同じ深さのものは、同じ高さに並ぶ
    #   2. 兄弟は左から順に、重ならずに並ぶ
    #   3. **親は、子たちの真ん中の上に来る**
    #
    # ## 交差はどこで減るのか
    #
    # 3 は「親の位置を子から決める」ので、**同じ深さの中での並び順**が図の見え方を決める。
    # 順番が悪いと線が交差する。そこで重心法を数周まわす——
    # 「つながっている相手の平均の位置」へ寄せることを繰り返すと、交差が減っていく。
    # 総当りで最適解を出すのは現実的でないが、数周で見た目は十分よくなる。
    class Layered
      # 重心法を何周まわすか。**増やしても頭打ちになる。**
      # 4周で交差はほぼ落ち着き、それ以上は計算時間だけ伸びる
      BARYCENTER_PASSES = 4

      # 深さが1つ下がるときの、縦の間隔（カードの高さぶんは別に足す）
      LEVEL_GAP = Metrics::MIN_CARD_GAP
      # 隣り合う兄弟の、横の間隔
      SIBLING_GAP = Metrics::MIN_CARD_GAP
      # 別の親を持つかたまり同士の間隔。兄弟より広く取って、群れの境目を見せる
      GROUP_GAP = Metrics::MIN_CARD_GAP * 1.5

      # **同じ段に置く関係。** 上下の無いつながり。
      #
      # これを段の材料に混ぜていた頃は、ゼウスの「妻」であるヘラや、
      # 「兄弟」であるポセイドンが、**子と同じ段へ落ちていた**。
      # 落ちた先から子へ線が引かれるので、その線は子の段を横切ることになる。
      # 家系図が家系図に見えないのは、ここが理由だった。
      #
      # どの種類が同列かは Relation が持つ。**ここで種類を数え上げない**

      # @param boxes [Array<Box>] 置くカード
      # @param edges [Array<Hash>] { from:, to:, type: } の並び（向きがある）
      # @param roots [Array<String>] 先頭に置きたい id（無ければ自動で選ぶ）
      # @param horizontal [Boolean] true なら左から右へ流す
      def initialize(boxes:, edges:, roots: [], horizontal: false)
        @boxes = boxes
        @by_id = boxes.to_h { |box| [ box.id, box ] }
        all = edges.select { |edge| @by_id.key?(edge[:from]) && @by_id.key?(edge[:to]) }
        # 段を作るのは上下のある関係だけ。同列の関係は**並び順にだけ**効かせる
        # **段を作るのは骨格だけ。**
        #
        # 以前は「同列でないもの全部」が段を作っていた。つまり
        # related（迷ったときの逃げ道）が親子と同じ強さで効いていて、
        # アルテミス -[related]-> アポロン だけでアポロンが子の段へ落ちた。
        @edges = Relation.spine(all)
        @peers = all.select { |edge| peer?(edge) }
        # 骨格に重ねるもの。**段は作らないが、行き場の無いカードは引き受ける**
        @extras = Relation.secondary(all).reject { |edge| peer?(edge) }
        # 並び順を決めるときは両方を見る（同列のものは隣どうしに寄せたい）
        @ordering_edges = all
        @roots = roots.select { |id| @by_id.key?(id) }
        @horizontal = horizontal
      end

      def call
        levels = assign_levels
        order_within_levels!(levels)
        centre_peer_hubs!(levels)
        pair_partners!(levels)
        place!(levels)
        @boxes
      end

      private

      def peer?(edge) = Relation.same_level?(edge[:type])

      # 深さを割り当てる。
      #
      # **輪になっているところは切る。** 「A の親が B、B の親が A」のような
      # 書かれ方をしても図にはできるようにする（後ろへ戻る線を1本無視する）。
      def assign_levels
        children = Hash.new { |hash, key| hash[key] = [] }
        parents = Hash.new { |hash, key| hash[key] = [] }
        @edges.each do |edge|
          children[edge[:from]] << edge[:to]
          parents[edge[:to]] << edge[:from]
        end
        # 骨格で置かれたカードは、あとから動かさない（並べ替えの判断に使う）
        @spine_parents = parents

        depth = {}
        # **親を持たないものは、全部を起点にする。**
        #
        # AI が挙げた根（@roots）だけを起点にしていた頃は、
        # 挙げられなかった親（配偶者など）がどこからもたどり着けず、
        # 「たどり着けなかったもの」として**子より下の段**に置かれていた。
        # AI の挙げる根は「いちばん上に置きたいもの」の助言であって、
        # 親を持たないものの全部ではない。
        starts = (@roots + natural_roots(parents)).uniq
        # 骨格が1本も無い図（所属や具体例だけで繋がっている）では、
        # **重ねる関係の上側を起点にする。**
        # ここを飛ばして「並びの先頭」に落ちると、たまたま先頭にあったカードが
        # 根になり、本当の上側と同じ段に並んでしまう
        starts = extra_root_ids(parents) if starts.empty?
        # それでも決まらない＝全部が輪の中。並びの先頭を起点にする
        starts = [ @boxes.first&.id ].compact if starts.empty?

        queue = starts.map { |id| [ id, 0 ] }
        starts.each { |id| depth[id] = 0 }
        until queue.empty?
          id, level = queue.shift
          children[id].each do |child|
            # **段の数はカードの枚数を超えない。**
            # 輪になっていると「A の子は B、B の子は A」を延々とたどって深くなり続ける。
            # 枚数で頭を打たせて、輪の1本を無視した形にする
            next if level + 1 >= @boxes.size
            # 既に見た深さ以上にはしない
            next if depth.key?(child) && depth[child] >= level + 1

            depth[child] = level + 1
            queue << [ child, level + 1 ]
          end
        end

        # 同列の相手が居るなら、その隣の段へ。
        # **上下の関係を1本も持たないカードでも、兄弟が居れば居場所は決まる。**
        # ここが無かった頃、ゼウスの兄弟であるポセイドンは
        # 「どこからもたどり着けなかったもの」として最下段へ落ちていた
        assign_peer_levels!(depth, parents)
        # 骨格がまったく無い組（所属だけで繋がった2枚など）に、起点を1つ与える
        seed_extra_roots!(depth, parents)
        # 骨格でも同列でも決まらなかったカードを、重ねる関係で引き受ける。
        # **既に置かれたカードは動かさない**（骨格を崩さないため）
        attach_extras!(depth, parents)
        assign_peer_levels!(depth, parents)

        # どこからもたどり着けなかったものは、いちばん下へ置く（消さない）
        orphan_level = (depth.values.max || 0) + 1
        @boxes.each { |box| depth[box.id] ||= orphan_level }

        depth.group_by { |_, level| level }
             .sort_by(&:first)
             .map { |_, pairs| pairs.map { |id, _| @by_id[id] }.compact }
      end

      # 同列の相手と同じ段へ寄せる。
      #
      # **動かすのは「上下の親を持たないもの」だけ。** 親を持つカードを
      # 兄弟に合わせて動かすと、その親との上下が壊れる。
      # 兄弟の連なり（A—B—C）をたどれるように、決まらなくなるまで繰り返す
      def assign_peer_levels!(depth, parents)
        @boxes.size.times do
          changed = false
          @peers.each do |edge|
            [ [ edge[:from], edge[:to] ], [ edge[:to], edge[:from] ] ].each do |target, source|
              next if depth.key?(target) || !depth.key?(source)
              next if parents[target].any?

              depth[target] = depth[source]
              changed = true
            end
          end
          break unless changed
        end
      end

      # 重ねる関係のうち、**下へ降ろす**もの。
      # 所属や具体例は「その下にある」と読めるが、related にその意味は無い
      BELOW = %w[belongs_to example part].freeze

      # 骨格に重ねる関係で、行き場の無いカードだけを引き受ける。
      #
      # パルテノン神殿は belongs_to しか持たない。骨格から外した以上、
      # ここで拾わないと「たどり着けなかったもの」として最下段の
      # 吹き溜まりへ落ちる。**拾うが、骨格は動かさない。**
      def attach_extras!(depth, parents)
        @boxes.size.times do
          changed = false
          @extras.each do |edge|
            step = BELOW.include?(edge[:type].to_s) ? 1 : 0
            if place_extra(depth, parents, edge[:to], edge[:from], step)
              changed = true
            elsif place_extra(depth, parents, edge[:from], edge[:to], -step)
              changed = true
            end
          end
          break unless changed
        end
      end

      # 骨格から完全に切り離された組にも、起点を与える。
      #
      # 所属（belongs_to）だけで繋がった2枚は、骨格から外した以上
      # どちらにも深さが付かず、そろって最下段の吹き溜まりへ落ちる。
      # **上下があると言っている線なら、上側を起点にする**
      def seed_extra_roots!(depth, parents)
        extra_root_ids(parents).each { |id| depth[id] ||= 0 }
      end

      # 重ねる関係のうち、上下があると言っている線の**上側**。
      # 下側にも上側にも見えるもの（自分へ入ってくる線がある）は根にしない
      def extra_root_ids(parents)
        below = @extras.select { |edge| BELOW.include?(edge[:type].to_s) }
        incoming = below.map { |edge| edge[:to] }.to_set
        below.map { |edge| edge[:from] }.uniq
             .reject { |id| parents[id].any? || incoming.include?(id) }
      end

      def place_extra(depth, parents, target, source, step)
        return false if depth.key?(target) || !depth.key?(source) || parents[target].any?

        depth[target] = [ depth[source] + step, 0 ].max
        true
      end

      # 起点にするのは「親を持たず、子を持つ」もの。
      #
      # **つながりが1本も無いカードを起点にしない。** 起点にすると最上段へ並び、
      # 図の頭に、関係の無いカードが根と同じ高さで混ざる。
      # そういうカードは下にまとめる（消さずに、読み筋からは外す）
      def natural_roots(parents)
        connected = @edges.flat_map { |edge| [ edge[:from], edge[:to] ] }.to_set
        @boxes.map(&:id).select { |id| connected.include?(id) && parents[id].empty? }
      end

      # 同じ深さの中の並び順を決める。**ここで線の交差が減る。**
      #
      # 上から下へ、下から上へと交互に、「つながっている相手の平均の位置」へ寄せる。
      # 位置が決まっていない相手は数えない（数えると全部が中央へ集まる）。
      def order_within_levels!(levels)
        BARYCENTER_PASSES.times do |pass|
          order = pass.even? ? levels.each_index.to_a : levels.each_index.to_a.reverse
          order.each do |index|
            reference = pass.even? ? levels[index - 1] : levels[index + 1]
            next if index.zero? && pass.even?
            next if reference.nil? || reference.empty?

            sort_by_barycenter!(levels[index], reference)
          end
        end
      end

      def sort_by_barycenter!(level, reference)
        position = reference.each_with_index.to_h { |box, index| [ box.id, index.to_f ] }
        neighbours = Hash.new { |hash, key| hash[key] = [] }
        # 同列の関係も見る。**兄弟は隣どうしに置きたい**
        @ordering_edges.each do |edge|
          neighbours[edge[:to]] << edge[:from]
          neighbours[edge[:from]] << edge[:to]
        end

        # 相手が居ないものは、いまの並びの位置を保つ（勝手に先頭へ来ない）
        keep = level.each_with_index.to_h { |box, index| [ box.id, index.to_f ] }
        level.sort_by! do |box|
          known = neighbours[box.id].filter_map { |id| position[id] }
          known.empty? ? keep[box.id] : known.sum / known.size
        end
      end

      # 同列で結ばれた2枚を、**必ず隣どうしにする**。
      #
      # 重心法は「つながっている相手の平均」へ寄せるだけなので、二人の間に
      # 別の兄弟が挟まることがある。挟まると、二人を結ぶ線がその兄弟をまたぎ、
      # **子へ降ろす幹も、どちらの二人のものか読めなくなる**。
      #
      # 動かすのは相手のほうだけ。並び全体をやり直さないので、
      # 重心法で減らした交差を壊さない
      # 同列の相手を3枚以上持つカードは、**その真ん中に置く。**
      #
      # 隣にできるのは1枚だけ（1枚を2度動かすと押し合いになる）。
      # ゼウスに兄弟が4枚いると、残りは段の端まで飛ばされ、
      # 段を横断する長い線になった（ゼウス—アルテミスで1506px）。
      # 親が子の真ん中に来るのと同じことを、同列でもする。
      #
      # **ただし動かすのは、骨格が置いていないカードだけ。**
      # 親から降りて並んだ子を兄弟の都合で並べ替えると、
      # せっかく揃えた親子の縦が崩れる（実測で交差が0→2に増えた）
      PEER_HUB_MIN = 3

      def centre_peer_hubs!(levels)
        levels.each do |level|
          ids = level.map(&:id).to_set
          hub = level.max_by { |box| movable_partners(box, ids).size }
          next if hub.nil? || movable_partners(hub, ids).size < PEER_HUB_MIN

          members = peer_component(level, hub, ids)
          gather!(level, members, hub)
        end
      end

      # 同列の相手のうち、骨格が置いていないもの
      def movable_partners(box, ids)
        (peer_partners[box.id] & ids).reject { |id| @spine_parents[id].any? }.to_set
      end

      # 中心からたどれる、同列でつながった一群。**骨格が置いたカードは入れない**
      def peer_component(level, hub, ids)
        found = Set.new([ hub.id ])
        queue = [ hub.id ]
        until queue.empty?
          movable_partners(@by_id[queue.shift], ids).each do |id|
            queue << id if found.add?(id)
          end
        end
        level.select { |box| found.include?(box.id) }
      end

      # 群れを、いまの並びの中で**いちばん先に出てくる位置**へ寄せ、
      # 真ん中に中心のカードを置く。群れ以外の並びは変えない
      def gather!(level, members, hub)
        arranged = arrange_around(hub, members)
        rebuilt = []
        placed = false
        level.each do |box|
          if members.include?(box)
            next if placed

            rebuilt.concat(arranged)
            placed = true
          else
            rebuilt << box
          end
        end
        level.replace(rebuilt)
      end

      # 中心から枝をたどって並べる。**枝は途中で切らない。**
      #
      # 中心の相手だけを隣に集めていた頃、その相手にぶら下がるカード
      # （ポセイドンの兄弟であるアポロン）が段の反対の端に取り残され、
      # 盤を1514px横断する線になった。枝ごと動かせば、枝の中は隣どうしになる
      def arrange_around(hub, members)
        pool = members.to_h { |box| [ box.id, box ] }
        pool.delete(hub.id)
        branches = peer_partners[hub.id].sort.filter_map { |id| walk_branch(pool, id) }
        # 中心からたどれなかったものは、そのまま右へ
        branches += pool.values.map { |box| [ box ] }
        half = branches.size / 2
        # 左側は枝の先が外、根が中心の隣に来るよう裏返す
        branches.first(half).flat_map(&:reverse) + [ hub ] + branches.drop(half).flatten
      end

      def walk_branch(pool, id)
        return nil unless pool.key?(id)

        chain = []
        queue = [ id ]
        until queue.empty?
          current = queue.shift
          box = pool.delete(current)
          next if box.nil?

          chain << box
          peer_partners[current].sort.each { |other| queue << other if pool.key?(other) }
        end
        chain
      end

      def peer_partners
        @peer_partners ||= Hash.new { |hash, key| hash[key] = Set.new }.tap do |map|
          @peers.each do |edge|
            map[edge[:from]] << edge[:to]
            map[edge[:to]] << edge[:from]
          end
        end
      end

      def pair_partners!(levels)
        pairs = couple_pairs
        return if pairs.empty?

        levels.each do |level|
          moved = Set.new
          pairs.each do |from_id, to_id|
            # **1枚を2度動かさない。** 兄弟にも夫婦にも寄せようとすると
            # 押し合いになり、どちらも隣り合わなくなる
            next if moved.include?(from_id) || moved.include?(to_id)

            left = level.index { |box| box.id == from_id }
            right = level.index { |box| box.id == to_id }
            next if left.nil? || right.nil?

            moved << from_id
            moved << to_id
            next if (left - right).abs == 1

            partner = level.delete_at(right)
            anchor = level.index { |box| box.id == from_id }
            level.insert(right > left ? anchor + 1 : anchor, partner)
          end
        end
      end

      # 隣にしたいのは、**離れていると読めなくなる組だけ**。
      #
      #   夫婦（共通の子を持つ）… 間に何か挟まると、幹がどちらのものか読めない
      #   同一視              … 「同じもの」なのに離れていたら、同じだと読めない
      #
      # 兄弟は入れない。隣り合っていなくても図は読めるし、
      # 兄弟まで寄せると夫婦と押し合って、どちらも隣り合わなくなる
      def couple_pairs
        @couple_pairs ||= begin
          children = @edges.group_by { |edge| edge[:from] }
                           .transform_values { |list| list.map { |edge| edge[:to] } }
          close = @peers.select { |edge| Relation.adjacent?(edge[:type]) }.filter_map do |edge|
            # 夫婦は、共通の子を持つときだけ（子が居なければ隣にする理由が弱い）
            next if Relation.couple?(edge[:type]) &&
                    (children[edge[:from]].to_a & children[edge[:to]].to_a).empty?

            [ edge[:from], edge[:to] ]
          end
          # **兄弟も隣にする。ただし夫婦・同一視を寄せたあとで。**
          #
          # 段だけ同じにして位置を決めずにいると、段の端と端に離れて置かれ、
          # 段を横断する長い線になる（ゼウス—アルテミスで1559px になった）。
          # 押し合いは pair_partners! の「1枚を2度動かさない」で止まる
          close + @peers.select { |edge| edge[:type].to_s == "sibling" }
                        .map { |edge| [ edge[:from], edge[:to] ] }
        end
      end

      # 座標を置く。
      #
      # **下から上へ組む。** 子を先に並べてから親をその真ん中へ寄せると、
      # 「親は子の真ん中の上」が一度で決まる。上から置くと、子を並べたあとに
      # 親を動かすことになり、動かした親の親がまたずれる。
      def place!(levels)
        return if levels.empty?

        row_positions = level_offsets(levels)
        # まず下の段から、兄弟のかたまりごとに詰めて置く
        levels.reverse.each_with_index do |level, reversed_index|
          index = levels.size - 1 - reversed_index
          pack_level!(level, levels[index + 1])
        end
        # 段の高さを当てる
        levels.each_with_index do |level, index|
          level.each { |box| set_cross_axis(box, row_positions[index]) }
        end
        shift_to_origin!
      end

      # 段ごとの位置（縦なら y、横なら x）。段の中で一番大きいものに合わせる
      def level_offsets(levels)
        offset = Metrics::BOARD_PADDING.to_f
        levels.map do |level|
          current = offset
          extent = level.map { |box| @horizontal ? box.width : box.height }.max || 0
          offset += extent + LEVEL_GAP
          current
        end
      end

      # 1つの段を詰める。子が既に置かれていれば、親をその真ん中へ。
      def pack_level!(level, children_level)
        centers = children_level ? child_centers(children_level) : {}
        cursor = 0.0
        previous_parent = nil
        previous_box = nil

        level.each do |box|
          wanted = centers[box.id]
          half = main_extent(box) / 2
          # 別の親のかたまりとは広めにあける
          gap = previous_parent && previous_parent != parent_key(box) ? GROUP_GAP : SIBLING_GAP
          # **強い関係どうしは近づける。** 距離にも意味を持たせる
          gap = tighten(gap, previous_box, box)
          lower_bound = cursor.zero? ? half : cursor + gap + half
          set_main_axis(box, [ wanted || lower_bound, lower_bound ].max)
          cursor = main_axis(box) + half
          previous_parent = parent_key(box)
          previous_box = box
        end
      end

      # 隣り合う2枚が強く結ばれているなら、間隔を詰める。
      #
      # **距離に意味を持たせる。** 同じ間隔で並べると、
      # 「たまたま隣にある」のか「強く結ばれている」のかが読めない。
      # 縮めるのは半分まで（詰めすぎると、まとまりではなく重なりに見える）
      MIN_GAP_RATIO = 0.5

      def tighten(gap, previous, box)
        return gap if previous.nil?

        strength = strength_between(previous.id, box.id)
        return gap if strength.nil?

        gap * (1.0 - (1.0 - MIN_GAP_RATIO) * strength)
      end

      def strength_between(a, b)
        @strengths ||= @ordering_edges.each_with_object({}) do |edge, map|
          value = edge[:strength].to_f
          next unless value.positive?

          key = [ edge[:from], edge[:to] ].sort
          map[key] = [ map[key].to_f, value ].max
        end
        @strengths[[ a, b ].sort]
      end

      # 子たちの中間。**ここが家系図の要。**
      def child_centers(children_level)
        placed = children_level.to_h { |box| [ box.id, main_axis(box) ] }
        by_parent = Hash.new { |hash, key| hash[key] = [] }
        @edges.each do |edge|
          next unless placed.key?(edge[:to])

          by_parent[edge[:from]] << placed[edge[:to]]
        end
        by_parent.transform_values { |positions| (positions.min + positions.max) / 2 }
      end

      def parent_key(box)
        @edges.find { |edge| edge[:to] == box.id }&.fetch(:from)
      end

      # 縦に流すか横に流すかで、主軸と交差軸が入れ替わる
      def main_axis(box) = @horizontal ? box.center_y : box.center_x
      def main_extent(box) = @horizontal ? box.height : box.footprint_width

      def set_main_axis(box, value)
        @horizontal ? box.center_y = value : box.center_x = value
      end

      def set_cross_axis(box, value)
        @horizontal ? box.x = value : box.y = value
      end

      # 左上に余白を残した位置へ、全体を寄せる
      def shift_to_origin!
        return if @boxes.empty?

        dx = Metrics::BOARD_PADDING - @boxes.map(&:left).min
        dy = Metrics::BOARD_PADDING - @boxes.map(&:top).min
        @boxes.each do |box|
          box.x += dx
          box.y += dy
        end
      end
    end
  end
end
