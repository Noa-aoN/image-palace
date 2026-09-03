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
      STRUCTURES = %w[auto hierarchy flow mindmap radial network cluster grid keep_shape].freeze

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

      Result = Struct.new(:boxes, :structure, :score, :notes, keyword_init: true)

      # @param boxes [Array<Box>]
      # @param relations [Array<Hash>] { from:, to:, strength: }
      # @param groups [Array<Hash>] { name:, members: }
      # @param structure [String] AI の見立て
      # @param roots [Array<String>]
      # @param move_weight [Float] 大きいほど「いまの形」を尊ぶ
      def initialize(boxes:, relations: [], groups: [], structure: "auto", roots: [],
                     move_weight: 1.0, movable: nil, direction: DEFAULT_DIRECTION)
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
      end

      def call
        return empty_result if @boxes.empty?

        candidates = build_candidates
        best = candidates.min_by { |candidate| candidate[:score].penalty }
        apply!(best)
        Result.new(
          boxes: @boxes, structure: best[:structure],
          score: best[:score], notes: best[:score].notes
        )
      end

      private

      def empty_result
        Result.new(boxes: [], structure: @structure, notes: [],
                   score: Score.new(boxes: [], edges: []))
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

      def build_candidates
        structures_to_try.uniq.map do |structure|
          boxes = @boxes.map { |box| box.dup_at(@previous[box.id][:x], @previous[box.id][:y]) }
          run_layout(structure, boxes)
          # どの形で組んでも、最後に重なりだけは必ず解く。
          # ただし「いまの形を活かす」ときは寄せ直さない（置いた場所が動く）
          Separator.new(boxes: boxes, movable: @movable,
                        reorigin: structure != "keep_shape").call
          {
            structure: structure, boxes: boxes,
            score: Score.new(boxes: boxes, edges: @relations, previous: @previous,
                             move_weight: @move_weight, groups: @groups)
          }
        end
      end

      def run_layout(structure, boxes)
        edges = @relations.map { |relation| { from: relation[:from], to: relation[:to] } }
        case structure
        when "hierarchy", "flow"
          Layered.new(boxes: boxes, edges: edges, roots: @roots,
                      horizontal: horizontal?(structure)).call
        when "mindmap"
          # 上下へ振り分けたいときもある（縦長の画面・縦書きの図）
          Mindmap.new(boxes: boxes, edges: edges, roots: @roots, vertical: @direction == "down").call
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

        structure == "flow"
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
