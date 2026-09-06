# frozen_string_literal: true

module Views
  module Layout
    # 意味の当たり具合を測る。**配置の点数（Score）とは分けて持つ。**
    #
    # 配置だけを見ていると、意味が抜けていても高い点が出る。
    # 14枚に線が6本しかなく、そのうち2本が事実として誤っている図が
    # 84点になったことがある。**測っていないものは、良くならない。**
    #
    # ここは正解を知らない。正解は呼ぶ側（Golden Board の fixture）が持つ。
    # **このクラスに特定の題材の知識を書いてはいけない。**
    class SemanticScore
      Entry = Struct.new(:key, :from, :to, :type, :label, :strength, keyword_init: true) do
        def to_s
          "#{from} -[#{type}]-> #{to}"
        end
      end

      Result = Struct.new(
        :expected, :detected, :matched, :missing, :extra,
        :wrong_type, :wrong_direction,
        :recall, :precision, :f1, :pair_recall,
        keyword_init: true
      ) do
        # 種類まで合っている本数
        def matched_count = matched.size
        def missing_count = missing.size
        def extra_count = extra.size
      end

      def self.call(expected:, detected:)
        new(expected: expected, detected: detected).call
      end

      def initialize(expected:, detected:)
        @expected = index(expected)
        @detected = index(detected)
      end

      def call
        matched = []
        wrong_type = []
        wrong_direction = []
        missing = []

        @expected.each do |key, want|
          got = @detected[key]
          if got.nil?           then missing << want
          elsif want.type != got.type then wrong_type << [ want, got ]
          elsif !same_direction?(want, got) then wrong_direction << [ want, got ]
          else matched << want
          end
        end
        extra = @detected.reject { |key, _| @expected.key?(key) }.values

        build(matched, missing, extra, wrong_type, wrong_direction)
      end

      private

      def build(matched, missing, extra, wrong_type, wrong_direction)
        recall = ratio(matched.size, @expected.size)
        precision = ratio(matched.size, @detected.size)
        Result.new(
          expected: @expected.size, detected: @detected.size,
          matched: matched, missing: missing, extra: extra,
          wrong_type: wrong_type, wrong_direction: wrong_direction,
          recall: recall, precision: precision,
          f1: harmonic(recall, precision),
          # 種類は違っても、**繋がってはいる**割合。
          # 孤立を減らせているかは、こちらのほうが素直に出る
          pair_recall: ratio(@expected.size - missing.size, @expected.size)
        )
      end

      def ratio(part, whole)
        whole.zero? ? 0.0 : (part.to_f / whole).round(3)
      end

      def harmonic(a, b)
        return 0.0 if (a + b).zero?

        ((2 * a * b) / (a + b)).round(3)
      end

      # 向きを問う必要があるのは、上下のある関係だけ。
      # 夫婦・兄弟・同一視は、どちらから書いても同じ意味になる
      def same_direction?(want, got)
        return true if Relation.same_level?(want.type)

        want.from == got.from && want.to == got.to
      end

      # 組（2枚の並び）で引ける形にする。**同じ組に線は1本**という
      # 本番の決まりに合わせるので、ここでも先に出たものを1本だけ持つ
      def index(relations)
        Array(relations).each_with_object({}) do |relation, out|
          from = at(relation, :from).to_s
          to = at(relation, :to).to_s
          next if from.empty? || to.empty? || from == to

          key = [ from, to ].sort
          out[key] ||= Entry.new(
            key: key, from: from, to: to,
            type: at(relation, :type).to_s, label: at(relation, :label),
            strength: at(relation, :strength)
          )
        end
      end

      def at(relation, name)
        relation[name].nil? ? relation[name.to_s] : relation[name]
      end
    end
  end
end
