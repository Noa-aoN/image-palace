# frozen_string_literal: true

module Views
  module Layout
    # 関係図・相関図。上下の関係が無い、網の目のつながりを置く。
    #
    # ## なぜ階層で置けないのか
    #
    # 階層は「親がひとつ」を前提にしている。人物の相関のように
    # **誰もが誰とでもつながる**図では、親を決められない。
    # 無理に段に割ると、線が段をまたいで走り、かえって読めなくなる。
    #
    # ## 引き合う力と、押し合う力
    #
    # 手で描くときと同じことをする。
    #   ・つながっているものは近づける（**強い関係ほど強く引く**）
    #   ・どのカードどうしも、近すぎれば押し離す
    #
    # これを何度か繰り返すと、関係の濃いところが自然に固まる。
    #
    # ## 毎回同じ図が出るようにする
    #
    # この種の配置は、ふつう乱数で初期位置を決めるので**呼ぶたびに違う図**になる。
    # ここでは id 順に円周へ並べてから始める。乱数を使わないので、
    # 同じ入力からは必ず同じ図が出る。
    class Network
      # 力を掛ける回数。**増やしても頭打ちになる。**
      # 200 でほぼ落ち着き、それ以上は計算時間だけ伸びる
      PASSES = 200
      # 1回で動かす量の上限（初回）。回を追うごとに小さくして、揺れを収める
      INITIAL_STEP = 60.0
      # つながっているものの、ちょうど良い距離
      IDEAL_DISTANCE = Metrics::CARD_WIDTH + Metrics::MIN_CARD_GAP
      # 押し合いが届く範囲。これより離れていれば干渉しない
      REPULSION_RANGE = IDEAL_DISTANCE * 2.5

      def initialize(boxes:, edges:)
        # **並び順を決めて始める。** 乱数を使わないので、同じ入力からは同じ図になる
        @boxes = boxes.sort_by(&:id)
        @by_id = @boxes.to_h { |box| [ box.id, box ] }
        @edges = edges.select { |edge| @by_id.key?(edge[:from]) && @by_id.key?(edge[:to]) }
      end

      def call
        return Grid.new(boxes: @boxes).call if @boxes.size < 3 || @edges.empty?

        seed_on_circle
        PASSES.times { |pass| relax(INITIAL_STEP * (1.0 - pass.to_f / PASSES)) }
        # 力だけでは重なりが残ることがある。最後に必ず解く
        Separator.new(boxes: @boxes, reorigin: false).call
        shift_to_origin!
        @boxes
      end

      private

      # 円周に等間隔で置く。**中心に固めない**（固めると押し合いだけで散らばり、形が出ない）
      def seed_on_circle
        radius = IDEAL_DISTANCE * Math.sqrt(@boxes.size) / 2
        @boxes.each_with_index do |box, index|
          angle = 2 * Math::PI * index / @boxes.size
          box.center_x = Math.cos(angle) * radius
          box.center_y = Math.sin(angle) * radius
        end
      end

      def relax(step)
        forces = Hash.new { |hash, key| hash[key] = [ 0.0, 0.0 ] }
        apply_attraction(forces)
        apply_repulsion(forces)

        forces.each do |id, (fx, fy)|
          box = @by_id[id]
          length = Math.hypot(fx, fy)
          next if length < 0.01

          # 一度に動かしすぎない（行き過ぎて振動する）
          scale = [ step, length ].min / length
          box.center_x += fx * scale
          box.center_y += fy * scale
        end
      end

      # つながっているものを引き寄せる。**強い関係ほど強く引く**
      def apply_attraction(forces)
        @edges.each do |edge|
          from = @by_id[edge[:from]]
          to = @by_id[edge[:to]]
          dx = to.center_x - from.center_x
          dy = to.center_y - from.center_y
          distance = Math.hypot(dx, dy)
          next if distance < 1

          # 強さが無い線も、ゆるく引く（0だと関係が図に出ない）
          strength = [ edge[:strength].to_f, 0.3 ].max
          pull = (distance - IDEAL_DISTANCE) * strength * 0.05
          ux = dx / distance
          uy = dy / distance
          add(forces, from.id, ux * pull, uy * pull)
          add(forces, to.id, -ux * pull, -uy * pull)
        end
      end

      # 近すぎるものを押し離す。**遠いものは見ない**（枚数の二乗を全部数えない）
      def apply_repulsion(forces)
        @boxes.combination(2) do |a, b|
          dx = b.center_x - a.center_x
          dy = b.center_y - a.center_y
          distance = Math.hypot(dx, dy)
          next if distance > REPULSION_RANGE

          # 完全に重なっていると向きが決まらない。id の順で決め打ちにする
          if distance < 1
            add(forces, a.id, -1.0, 0.0)
            add(forces, b.id, 1.0, 0.0)
            next
          end

          push = (REPULSION_RANGE - distance) * 0.12
          ux = dx / distance
          uy = dy / distance
          add(forces, a.id, -ux * push, -uy * push)
          add(forces, b.id, ux * push, uy * push)
        end
      end

      def add(forces, id, fx, fy)
        current = forces[id]
        forces[id] = [ current[0] + fx, current[1] + fy ]
      end

      def shift_to_origin!
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
