# frozen_string_literal: true

module Views
  module Layout
    # 関係の食い違いを見つける。
    #
    # ## なぜ要るのか
    #
    # AI は線を1本ずつ考えるので、**図全体として辻褄が合っているかを見ていない**。
    # 実際に、同じ2枚に「姉妹」と「娘」の両方が付くことがある。
    # どちらか一方は誤りだが、1本ずつ読んでいる限り気づけない。
    #
    # ここでは**線どうしを突き合わせて**、成り立たない組を見つける。
    # AI にもう一度聞き直すより速く、確実で、費用もかからない。
    #
    # ## 何を見つけるか
    #
    #   往復    … A→B と B→A の両方に、向きのある関係が付いている
    #   重複    … 同じ2枚に、意味の違う関係が2本ある
    #   輪      … 親子をたどると元へ戻る（誰かが自分の先祖になる）
    #   矛盾語  … 1本の線に、両立しない言葉が付いている（「姉妹」と「娘」など）
    #   世代飛び… 同じ2枚が、親子でありながら兄弟でもある
    class Consistency
      Issue = Struct.new(:kind, :from, :to, :message, keyword_init: true)

      # 向きのある関係。**逆向きに同じものが付いたら、どちらかが誤り**
      DIRECTED = %w[parent cause part example sequence means].freeze
      # 向きの無い関係。逆向きでも同じ意味になる
      SYMMETRIC = %w[contrast related].freeze

      # 1本の線に同時には成り立たない言葉。
      # **表記の揺れも拾う**（「子」と「娘」は同じ世代の関係）
      EXCLUSIVE_WORDS = [
        { name: "世代", groups: [ %w[親 父 母 祖父 祖母 先祖], %w[子 娘 息子 孫 子孫] ] },
        { name: "世代と同列", groups: [ %w[親 父 母 子 娘 息子 孫], %w[兄 弟 姉 妹 兄弟 姉妹 同僚 同期] ] },
        { name: "原因と結果", groups: [ %w[原因 要因], %w[結果 帰結] ] },
        { name: "全体と部分", groups: [ %w[全体 上位], %w[部分 下位 一部] ] }
      ].freeze

      def initialize(relations:, titles: {})
        @relations = relations
        @titles = titles
      end

      # @return [Array<Issue>]
      def issues
        @issues ||= directed_conflicts + duplicate_pairs + label_conflicts + cycles
      end

      def any? = issues.any?

      # 利用者に伝える一言
      def notes
        issues.map(&:message).uniq.first(5)
      end

      private

      def name(id) = @titles[id].presence || "カード"

      # A→B と B→A の両方に、向きのある関係が付いている。
      # **親子が双方向にあるのは、必ずどちらかが誤り**
      def directed_conflicts
        seen = {}
        found = []
        @relations.each do |relation|
          next unless DIRECTED.include?(relation[:type])

          reverse = seen[[ relation[:to], relation[:from] ]]
          if reverse && reverse[:type] == relation[:type]
            found << Issue.new(
              kind: "directed_conflict", from: relation[:from], to: relation[:to],
              message: "#{name(relation[:from])} と #{name(relation[:to])} が、" \
                       "互いに「#{label_of(relation)}」になっています"
            )
          end
          seen[[ relation[:from], relation[:to] ]] = relation
        end
        found
      end

      # 同じ2枚に、種類の違う関係が2本ある
      def duplicate_pairs
        by_pair = @relations.group_by { |relation| [ relation[:from], relation[:to] ].sort }
        by_pair.filter_map do |(a, b), group|
          kinds = group.map { |relation| relation[:type] }.uniq
          next if kinds.size <= 1
          # 向きの無いものどうしは重なってもよい
          next if kinds.all? { |kind| SYMMETRIC.include?(kind) }

          Issue.new(
            kind: "duplicate_pair", from: a, to: b,
            message: "#{name(a)} と #{name(b)} に、種類の違う線が#{kinds.size}本あります"
          )
        end
      end

      # 1本の線の言葉が、両立しない組に跨っている。
      # **「姉妹」と「娘」が同じ2枚に付く**のがこれ
      def label_conflicts
        by_pair = @relations.group_by { |relation| [ relation[:from], relation[:to] ].sort }
        by_pair.filter_map do |(a, b), group|
          labels = group.filter_map { |relation| relation[:label].presence }
          next if labels.size < 2

          clash = EXCLUSIVE_WORDS.find { |rule| conflicting?(labels, rule[:groups]) }
          next unless clash

          Issue.new(
            kind: "label_conflict", from: a, to: b,
            message: "#{name(a)} と #{name(b)} に「#{labels.uniq.join('」と「')}」が付いています" \
                     "（#{clash[:name]}が食い違っています）"
          )
        end
      end

      # 言葉が、両立しない2つの群れに跨っているか
      def conflicting?(labels, groups)
        matched = groups.map do |words|
          labels.any? { |label| words.any? { |word| label.include?(word) } }
        end
        matched.count(true) >= 2
      end

      # 親子をたどると元へ戻る。**誰かが自分の先祖になっている**
      def cycles
        parents = Hash.new { |hash, key| hash[key] = [] }
        @relations.each do |relation|
          parents[relation[:to]] << relation[:from] if relation[:type] == "parent"
        end
        return [] if parents.empty?

        # **たどる前に既定値を止める。** 既定値つきのまま走査すると、
        # 知らない鍵に触れた瞬間に新しい行ができて「走査中に鍵が増えた」で落ちる
        parents.default_proc = nil
        parents.default = [].freeze

        found = []
        parents.keys.each do |start|
          next unless reaches?(start, start, parents, Set.new)

          found << Issue.new(
            kind: "cycle", from: start, to: start,
            message: "#{name(start)} が、たどると自分自身の先祖になっています"
          )
        end
        found.uniq { |issue| issue.from }
      end

      def reaches?(target, current, parents, seen)
        parents[current].any? do |parent|
          next false unless seen.add?(parent)

          parent == target || reaches?(target, parent, parents, seen)
        end
      end

      def label_of(relation)
        relation[:label].presence || relation[:type]
      end
    end
  end
end
