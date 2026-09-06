# frozen_string_literal: true

module Views
  module Layout
    # 関係の種類が、図の上でどう振る舞うか。
    #
    # ## なぜ1か所に集めるのか
    #
    # 「同列かどうか」の判定が、段の割り当て・経路・採点・改善の**7か所に散っていた**。
    # しかもどれも `type == "peer"` という直書きだったので、
    # 種類を1つ足すたびに7か所を直すことになる。**必ずどこかが漏れる。**
    #
    # 種類が増えるのは分かっているので（夫婦・兄弟・同一視・所属…）、
    # 振る舞いのほうを名前で問えるようにする。
    module Relation
      # **段を作らない関係。** 上下ではなく、横に並ぶもの
      #
      #   spouse     … 夫婦
      #   sibling    … 兄弟姉妹
      #   equivalent … 同じものの別の呼び名（アテナとミネルヴァ）
      #   contrast   … 対比。並べて見比べるもの
      #   peer       … 旧データ。夫婦とも兄弟とも取れるので同列に含める
      SAME_LEVEL = %w[peer spouse sibling equivalent contrast].freeze

      # **幹（junction / bus）を作れる組。** 夫婦だけ。
      # 兄弟や同一視には子がぶら下がらないので、束ねる相手が無い
      COUPLE = %w[peer spouse].freeze

      # **束ねてはいけない関係。** 個別の線のほうが意味を読みやすい
      #
      # 同一視は「AとBは同じもの」で、束ねると何と何が同じなのか分からなくなる。
      # 対比も同じで、どれとどれを見比べるのかが線1本では読めない
      NEVER_BUNDLED = %w[equivalent contrast].freeze

      # 向きのある関係。逆向きに同じものが付いたら、どちらかが誤り
      DIRECTED = %w[parent cause part example sequence means belongs_to].freeze

      # **必ず隣どうしにする関係。**
      #
      #   spouse     … 間に何か挟まると、子へ降ろす幹がどちらのものか読めない
      #   equivalent … 「同じもの」なのに離れていたら、同じだと読めない
      #
      # 兄弟はここに入れない。**夫婦と押し合うと、どちらも隣り合わなくなる。**
      # ただし兄弟も「段は同じなのに位置は決めない」状態にしてはいけない
      # （それが段を横断する長い線を作った）。夫婦を寄せたあとの余りで
      # 隣にする——順序の話なので Layered が持つ
      ADJACENT = %w[peer spouse equivalent].freeze

      # **図の骨格を作る関係。** 段はこれだけで決める
      #
      # 骨格と装飾を分ける前は「同列でないもの全部」が段を作っていた。
      # つまり **related（迷ったときの逃げ道）が親子と同じ強さで効いていた**。
      # 実際、アルテミス -[related]-> アポロン のせいで、
      # アポロンがアルテミスの子の段へ落ちた。
      #
      # spouse は段を作らないが、骨格の一部（夫婦は幹の起点になる）。
      # 「段を作るか」と「骨格か」は別の問いなので、別の名前で持つ
      PRIMARY = %w[parent spouse peer sequence cause means part].freeze

      # **骨格に後から重ねる関係。** 置き場所を決められていないカードを
      # 引き寄せることはあるが、**既に置かれたカードを動かさない**
      SECONDARY = %w[sibling equivalent belongs_to contrast example related].freeze

      module_function

      def adjacent?(type) = ADJACENT.include?(type.to_s)
      def same_level?(type) = SAME_LEVEL.include?(type.to_s)
      def couple?(type) = COUPLE.include?(type.to_s)
      def bundleable?(type) = !NEVER_BUNDLED.include?(type.to_s)
      def directed?(type) = DIRECTED.include?(type.to_s)
      # 種類の無い線は骨格として扱う。**「分からない」を「弱い」に読み替えない。**
      # 古い盤の線や、種類を持たない入力は、これまでどおり段を作る
      def primary?(type) = type.to_s.empty? || PRIMARY.include?(type.to_s)
      def secondary?(type) = !primary?(type)

      # 段を作る関係だけを残す
      def hierarchical(relations) = relations.reject { |relation| same_level?(relation[:type]) }

      # 骨格を作る関係だけを残す（段を作るもの＝上下がある PRIMARY）
      def spine(relations)
        relations.select { |relation| primary?(relation[:type]) && !same_level?(relation[:type]) }
      end

      # 骨格に重ねる関係だけを残す
      def secondary(relations) = relations.select { |relation| secondary?(relation[:type]) }

      # **共通の親が図の中にいる兄弟の線。**
      #
      # 親子の線をたどれば兄弟だと読めるので、引くと同じことを二度言うことになる。
      # しかも兄弟の線は段を横切るので、図の上ではいちばん邪魔な1本になる。
      # 親が図にいないときは話が別で、そのときは兄弟の線が唯一の手がかりになる
      # **同列の網を、鎖1本ぶんまで減らす。**
      #
      # 兄弟は互いに兄弟なので、6枚いれば線は最大15本引ける。
      # だが図の上では「つながっている」ことが読めれば足りる。
      # 網のまま描くと、段の端から端まで走る線が何本もできる
      # （実測でポセイドン—アポロンが盤を1300px横断した）。
      #
      # **落とすのは輪を閉じる線だけ**なので、読める情報は減らない。
      # 相手の多いカードを先につないで、そこを幹にする
      # （幹は centre_peer_hubs! が段の真ん中へ置く）
      def surplus_siblings(relations)
        siblings = relations.select { |relation| relation[:type].to_s == "sibling" }
        return [] if siblings.size < 2

        degree = Hash.new(0)
        siblings.each { |relation| degree[relation[:from]] += 1; degree[relation[:to]] += 1 }
        groups = {}
        siblings
          .sort_by { |relation| [ -(degree[relation[:from]] + degree[relation[:to]]), relation[:from].to_s, relation[:to].to_s ] }
          .reject { |relation| join(groups, relation[:from], relation[:to]) }
      end

      # 2つを同じ群れにまとめる。既に同じ群れなら false（＝その線は輪を閉じる）
      def join(groups, one, other)
        left = root_of(groups, one)
        right = root_of(groups, other)
        return false if left == right

        groups[left] = right
        true
      end

      def root_of(groups, id)
        id = groups[id] while groups.key?(id) && groups[id] != id
        id
      end

      def redundant_siblings(relations)
        parents_of = Hash.new { |hash, key| hash[key] = Set.new }
        relations.each do |relation|
          parents_of[relation[:to]] << relation[:from] if relation[:type].to_s == "parent"
        end
        relations.select do |relation|
          next false unless relation[:type].to_s == "sibling"

          parents_of[relation[:from]].intersect?(parents_of[relation[:to]])
        end
      end

      # 同列の関係だけを残す
      def same_level(relations) = relations.select { |relation| same_level?(relation[:type]) }
    end
  end
end
