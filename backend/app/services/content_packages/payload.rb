# frozen_string_literal: true

module ContentPackages
  # 公式コンテンツの、持ち運べる形。
  #
  # 書き出し（Exporter）と取り込み（Importer）は、**同じ形に対する逆の操作**。
  # rake も公式工房の公開も、デモの宮殿づくりも Starter の受け取りも、
  # ぜんぶこの2つを呼ぶだけになる。だから形はここに1つだけ置く。
  #
  # ## 参照は local_key で持つ
  #
  # キャンバスの線は `view_edges.source_node_id` に**カードの id をそのまま文字列で**
  # 持っている（画面側の節の id がカードの id）。書き出したものを別の人へ入れると
  # id は変わるので、そのまま運ぶとどこにも繋がらない線ができる。
  #
  # **題では繋がない。** 同じ題のカードが2枚あると取り違えるし、
  # 題を直した瞬間に線が切れる。荷物の中だけで通じる `item_1` のような鍵を振り、
  # 取り込むときに新しい id へ引き直す。**見せる名前と、繋ぐための名前を分ける。**
  #
  # ## 絵は運ばない
  #
  # `image_key` は ActiveStorage の blob の鍵。取り込む側は**同じ blob を付け替える**
  # だけなので、何人に配っても保存領域は増えない。
  # 獲得物（`RewardDefinition#image_path`）が既に同じ持ち方をしている。
  module Payload
    # 形を変えたら上げる。取り込む側が、読めない形を黙って通さないようにするため。
    #
    #   1 … 箱ひとつ（"box"）＋キャンバス。箱に無いカードがキャンバスにあると失敗した
    #   2 … 箱は0個以上（"boxes"）。キャンバス単独でも配れる。
    #       足りないカードは書き出し側が引き込む。
    #       カードごとに origin_key（荷物をまたいで変わらない目印）を持つ
    SCHEMA_VERSION = 2

    class Error < StandardError; end

    # 書き出せなかった（元の側に欠けがある）
    class ExportError < Error; end

    # 取り込めなかった（荷物の側に欠けがある・参照が合わない）
    class ImportError < Error; end

    module_function

    # 荷物の形をざっと確かめる。**取り込む前に落とす**ためのもの。
    # 中身の正しさ（絵が実在するか等）は Importer が個別に見る
    def validate!(payload)
      raise ImportError, "荷物が空です" if payload.blank?

      schema = payload["schema"]
      unless schema == SCHEMA_VERSION
        raise ImportError, "読めない形式です（schema=#{schema.inspect} / 読めるのは #{SCHEMA_VERSION}）"
      end

      items = payload["items"]
      raise ImportError, "カードが1枚もありません" if items.blank?

      keys = items.map { |i| i["local_key"] }
      raise ImportError, "local_key の無いカードがあります" if keys.any?(&:blank?)

      dup = keys.tally.select { |_, n| n > 1 }.keys
      raise ImportError, "local_key が重複しています: #{dup.join(', ')}" if dup.any?

      # 荷物をまたいで同じカードだと分かるための目印。
      # 欠けていると、受け取るたびに同じカードが増える
      origins = items.map { |i| i["origin_key"] }
      raise ImportError, "origin_key の無いカードがあります" if origins.any?(&:blank?)

      dup_origins = origins.tally.select { |_, n| n > 1 }.keys
      raise ImportError, "origin_key が重複しています: #{dup_origins.join(', ')}" if dup_origins.any?

      validate_references!(payload, keys.to_set)
      payload
    end

    # 「箱1つ」だった頃の形を、うっかり通さないための目印。
    # v1 は `"box"`（単数）を持っていた
    def legacy_shape?(payload)
      payload.is_a?(Hash) && payload.key?("box")
    end

    # 荷物の中の参照が、荷物の中で閉じているか。
    # **外を指す参照が1つでもあれば、取り込んだ先で壊れる**
    def validate_references!(payload, keys)
      Array(payload["boxes"]).each do |box|
        Array(box["entries"]).each do |entry|
          next if keys.include?(entry["local_key"])

          raise ImportError, "箱「#{box['name']}」が知らないカードを指しています: #{entry['local_key'].inspect}"
        end
      end

      Array(payload["views"]).each do |view|
        Array(view["placements"]).each do |placement|
          next if keys.include?(placement["local_key"])

          raise ImportError, "キャンバス「#{view['name']}」が知らないカードを置いています: #{placement['local_key'].inspect}"
        end

        Array(view["edges"]).each do |edge|
          %w[source target].each do |side|
            next if keys.include?(edge[side])

            raise ImportError, "キャンバス「#{view['name']}」の線が知らないカードを指しています: #{edge[side].inspect}"
          end
        end
      end
    end
  end
end
