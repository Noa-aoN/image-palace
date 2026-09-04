# frozen_string_literal: true

module Views
  module Layout
    # 関係を線として見せてよいか。
    #
    # ## なぜ要るのか
    #
    # AI は確からしさ（0〜1）を付けて関係を返すが、**それを一度も見ていなかった。**
    # 思いつきで書かれた関係も、確かな関係と同じ太さの線になっていた。
    #
    # 図は「そう読める」と言い切るものなので、**弱い推測を線にすると嘘になる**。
    # 見せないほうが、間違ったことを見せるよりよい。
    #
    # ## 種類ごとに変えられるようにする
    #
    # **事実を言う関係ほど、確かでないと出さない。**
    # 「AはBの親だ」は間違っていれば誤りだが、「AはBと関係がある」は幅がある。
    # だから親子・夫婦・同一視は高めに、その他は低めにする。
    #
    # ここが唯一の出どころ。**各所に 0.5 を書かない**（変えるときに探し回ることになる）
    module Confidence
      # 種類ごとの決めが無いときの下限
      MINIMUM = 0.5

      # 種類ごとの下限。**事実関係を言うものほど高くする**
      THRESHOLDS = {
        # 誰の子か・誰と結ばれたかは、間違っていれば誤り
        "parent" => 0.6,
        "spouse" => 0.6,
        "sibling" => 0.6,
        # 同じものだと言い切る。取り違えると2枚が1枚に見える
        "equivalent" => 0.65,
        # どこに属するか
        "belongs_to" => 0.55,
        # 話の筋。読み取りの幅があるので、少し緩める
        "cause" => 0.5,
        "sequence" => 0.5,
        "means" => 0.5,
        "part" => 0.5,
        "example" => 0.5,
        "contrast" => 0.5,
        # 「その他」は幅がある。ここを厳しくすると、緩い繋がりが全部消える
        "related" => 0.4,
        # 旧データの同列。夫婦とも兄弟とも取れるので、それらに合わせる
        "peer" => 0.6
      }.freeze

      module_function

      def threshold_for(type) = THRESHOLDS.fetch(type.to_s, MINIMUM)

      # 線にしてよいか。**確からしさが無いものは通す**
      # （古い応答には strength が無い。無いことを「弱い」とは読まない）
      def enough?(type, strength)
        return true if strength.nil?

        strength.to_f >= threshold_for(type)
      end
    end
  end
end
