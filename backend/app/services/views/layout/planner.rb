# frozen_string_literal: true

module Views
  module Layout
    # 構造から配置を作る。**ここが「AI に座標を出させる」の代わり。**
    #
    # AI が返すのは「これは階層だ」「この3枚はひと群れだ」「A の親は B だ」
    # という**意味と構造**だけ。座標はここで解く。
    #
    # そうすると、
    #   ・出力の量がカードの枚数に比例しなくなる（44枚で切れていた壁が消える）
    #   ・同じ入力からは必ず同じ図が出る
    #   ・整列の責任が1か所になる（AI が揃えたものをコードが崩さない）
    #
    # ## 案を何通りか作って比べる
    #
    # 構造の見立てが外れることはある。「階層だ」と言われても線が網の目なら、
    # 階層に並べるより群れに分けたほうが読める。**採点して良いほうを採る。**
    # 枚数が多いときは1案だけにする（比べる時間のほうが惜しくなる）。
    class Planner
      # 案を比べる上限の枚数。これを超えたら見立てどおりに1案だけ作る
      MAX_CANDIDATES_FOR_COMPARISON = 60

      # ここまで来たら、そこで終わる。**満点を狙って動かし続けない**
      # （最後の数点は線の引き方の話で、置き場所を動かしても届かない）
      TARGET_POINTS = 92
      # 「念入り」で登り直す回数。時間が尽きればその前に止まる
      THOROUGH_ROUNDS = 12

      # 見立ての名前。知らない語は auto へ落とす
      # 図の種別。**同じ絵を別の名前で並べない。**
      #
      #   hierarchy … 階層図・組織図・樹形図。親から子へ。**向きは direction で決める**
      #   flow      … 流れ図。順序のあるものを一列に。**向きは direction で決める**
      #   mindmap   … マインドマップ。中心から左右へ振り分ける
      #   radial    … 放射図。中心から360度へ。距離が意味を持つ図
      #   network   … 関係図・相関図。上下が無い網の目。強さで引き合う
      #   cluster   … グループ図。まとまりごとに島を作る
      #   grid      … 並べるだけ。関係で並べる理由が無いとき
      #   keep_shape… いまの形を活かす
      #
      # 「樹形図」を別立てにしていないのは、**向きが違うだけで同じ組み方**だから。
      # 種別を増やすと選ぶ手間だけ増えて、出てくる図は変わらない
      # 作例集の8つに、置き方の受け皿を1つ足したもの。
      #
      #   hierarchy … 階層図・分類図。親から子へ枝分かれ。**向きは direction で決める**
      #   flow      … 流れ図。手順やプロセスの連なり。戻り線があってもよい
      #   timeline  … 時系列図。**時間の軸が1本**あり、出来事がその上に並ぶ
      #   mindmap   … 関係マップ。中心の主題から左右へ振り分けて広げる
      #   radial    … 相関図。中心から360度へ。中心からの遠さ自体に意味がある
      #   network   … ネットワーク図。上下が無い網の目。多対多の影響
      #   cluster   … 分類図（まとまり重視）。島ごとに分ける
      #   comparison… 比較図。**群れを列にして、行を揃える**
      #   grid      … 並べるだけ。関係で並べる理由が無いとき
      #   keep_shape… いまの形を活かす
      STRUCTURES = %w[
        auto hierarchy flow timeline mindmap radial network cluster comparison grid keep_shape
      ].freeze

      # 流れの向き。**種別とは別の軸にする。**
      #
      # 「階層＝上から下」「流れ＝左から右」と種別に結びつけていたが、
      # 組織図を横に伸ばしたいことも、手順を縦に並べたいこともある。
      # 向きだけを変えたいのに種別を選び直させるのは、**別のことを選ばせている**。
      #
      #   auto … 種別に合わせる（階層は縦、流れは横）
      #   down … 上から下へ
      #   right… 左から右へ
      DIRECTIONS = %w[auto down right].freeze
      DEFAULT_DIRECTION = "auto"

      Result = Struct.new(:boxes, :structure, :score, :notes, :improvement, keyword_init: true)

      # @param boxes [Array<Box>]
      # @param relations [Array<Hash>] { from:, to:, strength: }
      # @param groups [Array<Hash>] { name:, members: }
      # @param structure [String] AI の見立て
      # @param roots [Array<String>]
      # @param move_weight [Float] 大きいほど「いまの形」を尊ぶ
      def initialize(boxes:, relations: [], groups: [], structure: "auto", roots: [],
                     move_weight: 1.0, movable: nil, direction: DEFAULT_DIRECTION,
                     obstacles: {}, issues: [], thorough: false)
        @boxes = boxes
        @relations = relations
        @groups = groups
        @structure = STRUCTURES.include?(structure.to_s) ? structure.to_s : "auto"
        @direction = DIRECTIONS.include?(direction.to_s) ? direction.to_s : DEFAULT_DIRECTION
        @roots = roots
        @move_weight = move_weight
        # 動かしてよい id。nil は全部。「置き場所を触らない」ときに使う
        @movable = movable
        @previous = boxes.to_h { |box| [ box.id, { x: box.x, y: box.y } ] }
        # 線をよける相手（図形）。**測るときと引くときで同じものを見る**
        @obstacles = obstacles
        # 関係の食い違い。意味の正しさ（A群）はここから点になる
        @issues = issues
        # 念入りに整えるか。**時間をかけて良いか**を利用者が決める
        @thorough = thorough
      end

      def call
        return empty_result if @boxes.empty?

        # **待たせる時間は、整える全体で測る。**
        # 改善の輪だけに予算を付けていた頃は、案を作る時間が予算の外にあり、
        # 「標準は2秒」と言いながら2.5秒かかっていた
        @started_at = now
        candidates = build_candidates
        # **点数が高いほうを採る。** 同点なら先に作ったほう（見立てどおりの形）
        best = candidates.max_by.with_index { |candidate, index| [ candidate[:score].points, -index ] }
        best = improve(best)
        apply!(best)
        Result.new(
          boxes: @boxes, structure: best[:structure],
          score: best[:score], notes: best[:score].notes, improvement: @improvement
        )
      end

      private

      # **点数が上がる方へ動かす。**
      #
      # 案を作って比べるだけでは、案の中にしか答えが無い。
      # 出来上がった図に小さな手を当てて、上がったら残す。
      # 「いまの形を活かす」ときは動かさない（動かさないことが約束なので）
      # **点数が上がる方へ動かす。**
      #
      # ## 終わり方を決めておく
      #
      # 「念入り」が何をしているのか分からない、という状態にしない。
      # 終わる条件は3つで、**どれで終わったかを利用者に伝える**。
      #
      #   1. 目標点に届いた（TARGET_POINTS）
      #   2. 決めた回数だけ登り直した
      #   3. 時間が尽きた
      #
      # ## 登り直す
      #
      # 同じ所から登ると毎回同じ頂へ着く。1手だけわざと崩してから登り直すと、
      # 別の頂へ着くことがある。**「念入り」はこれを繰り返す**のが中身
      def improve(candidate)
        return candidate if candidate[:structure] == "keep_shape"
        return candidate if @boxes.size > MAX_CANDIDATES_FOR_COMPARISON

        total = @thorough ? Improver::THOROUGH_BUDGET : Improver::STANDARD_BUDGET
        rounds = @thorough ? THOROUGH_ROUNDS : 1
        best = candidate
        @improvement = { from: candidate[:score].points, rounds: 0, tried: 0, kept: 0, reason: "already_good" }

        rounds.times do |round|
          break @improvement[:reason] = "reached_target" if best[:score].points >= TARGET_POINTS

          budget = total - (now - @started_at)
          break @improvement[:reason] = "out_of_time" if budget <= 0

          @improvement[:rounds] = round + 1
          attempt = climb(best, budget: budget, perturb: round.zero? ? nil : round)
          best = attempt if attempt && attempt[:score].points > best[:score].points
          @improvement[:reason] = "tried_all" if round == rounds - 1
        end

        @improvement[:to] = best[:score].points
        best
      end

      # 1回ぶん登る。**押しのけで崩れたら、その回は無かったことにする**
      def climb(candidate, budget:, perturb:)
        boxes = candidate[:boxes].map { |box| box.dup_at(box.x, box.y) }
        result = Improver.new(
          boxes: boxes, relations: @relations,
          score_for: ->(list) { score_for(list) }, budget: budget,
          score: perturb.nil? ? candidate[:score] : nil, perturb: perturb
        ).call
        @improvement[:tried] += result[:tried]
        @improvement[:kept] += result[:kept]
        return nil if result[:kept].zero? && perturb.nil?

        Separator.new(boxes: result[:boxes], movable: @movable).call
        { structure: candidate[:structure], boxes: result[:boxes], score: score_for(result[:boxes]) }
      end

      def now = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      # 控えた座標へ戻す。**同じ箱を書き換えている**ので、作り直さずに戻す
      def restore!(boxes, snapshot)
        by_id = boxes.to_h { |box| [ box.id, box ] }
        snapshot.each do |id, x, y|
          box = by_id[id]
          next if box.nil?

          box.x = x
          box.y = y
        end
      end

      def empty_result
        Result.new(boxes: [], structure: @structure, notes: [],
                   score: Score.new(boxes: [], edges: [], issues: @issues))
      end

      # 試す形を決める。**見立てを最優先に置き、外れたときの受け皿を足す。**
      def structures_to_try
        return [ @structure ] if @structure == "keep_shape"
        return [ @structure ] if @boxes.size > MAX_CANDIDATES_FOR_COMPARISON && @structure != "auto"

        # **選ばれた形は、そのまま作る。**
        #
        # 近い形も試して良いほうを採る作りにしていたが、それだと
        # 「階層図」を選んだのに流れ図が返ることがあった。
        # 選んだものと違う図が出るのは、選ばせていないのと同じ。
        #
        # 迷っているのは「おまかせ」のときだけなので、比べるのもそのときだけにする。
        return [ @structure ] unless @structure == "auto"

        detect_structures
      end

      # 見立てが「おまかせ」のとき、**線の張られ方から形を推し量る**。
      #
      # 見るのは3つだけ。
      #   ・線が無い          … 並べるしかない
      #   ・親がひとつずつ    … 木。中心が1つなら中心から広げたほうが読める
      #   ・親が複数ある      … 網。段に割ると線が段をまたいで走る
      def detect_structures
        return [ "grid", "cluster" ] if @relations.empty?
        # 群れが2つ以上あって、線がほとんど無い＝**比べたいものが並んでいる**
        return [ "comparison", "cluster" ] if comparison?
        # 順序の関係ばかり＝時間の軸が1本ある
        return [ "timeline", "flow" ] if timeline?

        parents = Hash.new(0)
        children = Hash.new(0)
        @relations.each do |relation|
          parents[relation[:to]] += 1
          children[relation[:from]] += 1
        end

        return [ "network", "cluster" ] unless parents.values.all? { |count| count <= 1 }

        # 木。根がひとつで、そこから多く広がるならマインドマップの形が合う
        roots = @boxes.map(&:id).reject { |id| parents[id].positive? }
        wide_single_root = roots.size == 1 && children[roots.first] >= 4
        wide_single_root ? [ "mindmap", "hierarchy" ] : [ "hierarchy", "mindmap" ]
      end

      # 比べる図。**群れが2つ以上あり、群れをまたぐ線が少ない。**
      # 線で繋がっているなら、比べるより関係を見せたほうがよい
      def comparison?
        return false if @groups.size < 2

        members = @groups.each_with_index.flat_map { |group, index| Array(group[:members]).map { |id| [ id, index ] } }
        column_of = members.to_h
        crossing = @relations.count do |relation|
          from = column_of[relation[:from]]
          to = column_of[relation[:to]]
          from && to && from != to
        end
        crossing <= @relations.size / 3
      end

      # 時系列。**順序の関係が大半で、枝分かれが少ない**
      def timeline?
        directed = @relations.reject { |relation| relation[:type].to_s == "peer" }
        return false if directed.size < 2

        sequential = directed.count { |relation| relation[:type].to_s == "sequence" }
        sequential >= directed.size * 0.6
      end

      def build_candidates
        structures_to_try.uniq.map do |structure|
          boxes = @boxes.map { |box| box.dup_at(@previous[box.id][:x], @previous[box.id][:y]) }
          run_layout(structure, boxes)
          # **近いものを揃えてから、重なりを解く。**
          # 揃えるのを後にすると、押しのけたばかりのものをまた動かすことになる
          Align.new(boxes: boxes).call unless structure == "keep_shape"
          # どの形で組んでも、最後に重なりだけは必ず解く。
          # ただし「いまの形を活かす」ときは寄せ直さない（置いた場所が動く）
          Separator.new(boxes: boxes, movable: @movable,
                        reorigin: structure != "keep_shape").call
          { structure: structure, boxes: boxes, score: score_for(boxes) }
        end
      end

      # **実物で測る。** 線の道すじと文字の場所を、書き込むときと同じ手で組んでから採点する。
      # 両端を結ぶ直線で近似していた頃は、測っている図と目に見える図が別物だった
      def score_for(boxes)
        lines = Geometry.call(boxes: boxes, relations: @relations, obstacles: @obstacles)
        Score.new(boxes: boxes, edges: @relations, previous: @previous,
                  move_weight: @move_weight, groups: @groups, lines: lines, issues: @issues)
      end

      def run_layout(structure, boxes)
        # 種類も渡す。**同列の関係（兄弟・配偶者）を段の材料にしない**ため
        edges = @relations.map { |relation| { from: relation[:from], to: relation[:to], type: relation[:type] } }
        case structure
        when "hierarchy", "flow"
          Layered.new(boxes: boxes, edges: edges, roots: @roots,
                      horizontal: horizontal?(structure)).call
        when "mindmap"
          # 上下へ振り分けたいときもある（縦長の画面・縦書きの図）
          Mindmap.new(boxes: boxes, edges: edges, roots: @roots, vertical: @direction == "down").call
        when "timeline" then Timeline.new(boxes: boxes, edges: edges).call
        when "comparison" then Comparison.new(boxes: boxes, groups: @groups).call
        when "radial" then Radial.new(boxes: boxes, edges: edges, roots: @roots).call
        when "network" then Network.new(boxes: boxes, edges: @relations).call
        when "cluster" then Clustered.new(boxes: boxes, groups: @groups).call
        when "keep_shape" then KeepShape.new(boxes: boxes, movable: @movable).call
        else Grid.new(boxes: boxes).call
        end
      end

      # 横へ流すか。**向きの指定が優先**。指定が無ければ種別の既定に従う
      #   階層 … 縦（親を上、子を下）
      #   流れ … 横（左から右へ）
      def horizontal?(structure)
        return @direction == "right" unless @direction == "auto"

        # 流れ図と時系列図は、横に読むのが既定（時間は左から右へ流れる）
        %w[flow timeline].include?(structure)
      end

      # 選んだ案の座標を、もとの箱へ書き戻す
      def apply!(candidate)
        placed = candidate[:boxes].to_h { |box| [ box.id, box ] }
        @boxes.each do |box|
          winner = placed[box.id]
          next unless winner

          box.x = winner.x
          box.y = winner.y
        end
      end
    end
  end
end
