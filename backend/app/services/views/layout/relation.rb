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
      # 兄弟は入れない。隣り合っていなくても図は読めるし、
      # 兄弟まで寄せると夫婦と押し合って、どちらも隣り合わなくなる
      ADJACENT = %w[peer spouse equivalent].freeze

      module_function

      def adjacent?(type) = ADJACENT.include?(type.to_s)
      def same_level?(type) = SAME_LEVEL.include?(type.to_s)
      def couple?(type) = COUPLE.include?(type.to_s)
      def bundleable?(type) = !NEVER_BUNDLED.include?(type.to_s)
      def directed?(type) = DIRECTED.include?(type.to_s)

      # 段を作る関係だけを残す
      def hierarchical(relations) = relations.reject { |relation| same_level?(relation[:type]) }

      # 同列の関係だけを残す
      def same_level(relations) = relations.select { |relation| same_level?(relation[:type]) }
    end
  end
end
