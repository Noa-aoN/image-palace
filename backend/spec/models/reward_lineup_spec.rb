require "rails_helper"

# 獲得物の品揃え。
#
# **数と配る道が揃っていないと、埋まらない枠が並ぶ。**
# 定義だけ増やして条件を用意し忘れると、一覧に「取れないもの」が残る。
RSpec.describe "獲得物の品揃え" do
  # 位（プランに付く称号）は、ここで見ている品揃えの外。
  #
  # ここが確かめているのは「**集めて取るもの**が、取れる道と数と絵を持っているか」。
  # 位は稼いで取るものではなく、契約している間だけ持つものなので、
  # 実績から配られないし、段も 8・9 を使う。同じ物差しで測ると必ず落ちる
  let(:rewards) { RewardDefinition::BUILTINS.reject { |r| r.dig(:metadata, "source") == "subscription" } }
  let(:ranks) { RewardDefinition::BUILTINS.select { |r| r.dig(:metadata, "source") == "subscription" } }
  let(:achievements) { AchievementDefinition::BUILTINS }

  def keys_of(kind) = rewards.select { |r| r[:kind] == kind }.map { |r| r[:key] }

  describe "数" do
    it "称号・勲章は12ずつ、宝物は18、表彰は5" do
      expect(keys_of("title").size).to eq(12)
      expect(keys_of("medal").size).to eq(12)
      expect(keys_of("treasure").size).to eq(18)
      expect(keys_of("honor").size).to eq(5)
    end

    it "鍵が重複していない" do
      keys = rewards.map { |r| r[:key] }

      expect(keys.uniq.size).to eq(keys.size)
    end

    it "同じ種別の中で並び順が重複していない（どちらが先か決まらない）" do
      RewardDefinition::KINDS.each do |kind|
        positions = RewardDefinition::BUILTINS.select { |r| r[:kind] == kind }.map { |r| r[:position] }

        expect(positions.uniq.size).to eq(positions.size), "#{kind} の position が重複"
      end
    end
  end

  describe "配る道" do
    let(:granted) do
      achievements.flat_map { |a| Array(a[:rewards]) }
                  .select { |r| r["type"] == "reward" }.map { |r| r["key"] }
    end

    it "表彰以外は、すべて実績から配られる（取れないものを並べない）" do
      earnable = rewards.reject { |r| r[:kind] == "honor" }.map { |r| r[:key] }

      expect(earnable - granted).to be_empty
    end

    # 表彰は運営が手で贈るもの。条件では配らない
    it "表彰は実績から配らない" do
      expect(granted & keys_of("honor")).to be_empty
    end

    it "実績が指す獲得物は、すべて定義されている" do
      expect(granted.uniq - rewards.map { |r| r[:key] }).to be_empty
    end

    it "同じ目標値の実績を、同じ条件で二重に置かない" do
      pairs = achievements.map { |a| [ a[:condition_type], a[:condition_target] ] }
      duplicated = pairs.tally.select { |_, n| n > 1 }.keys

      # のべ365日だけは、クレジットと勲章で別々に置いてある既存の並び
      expect(duplicated).to eq([ [ "active_days", 365 ] ])
    end
  end

  describe "段" do
    it "条件で配るものは7段まで（8・9は表彰のために空けておく）" do
      levels = rewards.reject { |r| r[:kind] == "honor" }.map { |r| r[:rarity_level] }

      expect(levels.max).to be <= 7
    end

    it "運営だけのものは、表彰の中にだけある" do
      admin_only = rewards.select { |r| r[:admin_only] }

      expect(admin_only.map { |r| r[:key] }).to eq([ "honor_archon" ])
      expect(admin_only.map { |r| r[:kind] }).to eq([ "honor" ])
    end
  end

  describe "位（プランに付く称号）" do
    # 5つの段それぞれに1つずつ。どこか1つでも欠けると、
    # その段の人だけ位が無い（同期は「引けなければ何もしない」ので、静かに欠ける）
    it "プランの段すべてに、位が1つずつある" do
      expect(ranks.map { |r| r.dig(:metadata, "tier") }).to eq(%w[free standard pro creator studio])
    end

    it "位はすべて称号" do
      expect(ranks.map { |r| r[:kind] }.uniq).to eq([ "title" ])
    end

    # 同期はこの2つで引く。綴りが変わると、剥奪が効かないまま位が残る
    it "位は source と tier で引ける" do
      ranks.each do |rank|
        expect(RewardDefinition.rank_for_tier(rank.dig(:metadata, "tier"))&.key).to eq(rank[:key])
      end
    end

    it "位は実績から配らない（契約で決まるもの）" do
      granted = achievements.flat_map { |a| Array(a[:rewards]) }
                            .select { |r| r["type"] == "reward" }.map { |r| r["key"] }

      expect(granted & ranks.map { |r| r[:key] }).to be_empty
    end
  end

  describe "手に入れ方" do
    # 「運営から贈られます」とだけ出ていた。待てば届くのか、
    # 何かすれば届くのかが分からないまま一覧に並び続ける
    it "実績で配らないものにも、手に入れ方が書いてある" do
      granted = achievements.flat_map { |a| Array(a[:rewards]) }
                            .select { |r| r["type"] == "reward" }.map { |r| r["key"] }
      not_earned = RewardDefinition::BUILTINS.reject { |r| granted.include?(r[:key]) }

      missing = not_earned.reject { |r|
        r.dig(:metadata, "grant_note").present? || r.dig(:metadata, "source") == "subscription"
      }

      expect(missing.map { |r| r[:key] }).to be_empty
    end

    # 行は先に在るので、あとから足した説明が入らないと古いままになる
    it "既にある行にも、あとから足した説明が入る" do
      RewardDefinition.registry
      row = RewardDefinition.find_by(key: "honor_beta")
      row.update_columns(metadata: row.metadata.except("grant_note"))
      RewardDefinition.instance_variable_set(:@builtins_checked, false)

      RewardDefinition.registry

      expect(row.reload.metadata["grant_note"]).to be_present
    end

    it "運営が書き換えた説明は戻さない" do
      RewardDefinition.registry
      row = RewardDefinition.find_by(key: "honor_beta")
      row.update_columns(metadata: row.metadata.merge("grant_note" => "運営が書き換えた説明"))
      RewardDefinition.instance_variable_set(:@builtins_checked, false)

      RewardDefinition.registry

      expect(row.reload.metadata["grant_note"]).to eq("運営が書き換えた説明")
    end
  end

  describe "絵" do
    it "すべての獲得物が、絵のもとになる言葉を持つ" do
      missing = rewards.reject { |r| r.dig(:metadata, "motif").present? }

      expect(missing.map { |r| r[:key] }).to be_empty
    end

    # 絵の実体は1度だけ作って、環境をまたいで同じものを指す。
    # **鍵をここに書き戻さないと、環境ごとに作り直すことになる**（そのぶん請求が来る）
    it "すべての獲得物が、作った絵の鍵を持つ" do
      missing = rewards.reject { |r| r[:image_key].present? }

      expect(missing.map { |r| r[:key] }).to be_empty
    end

    it "同じ絵を2つの獲得物で指していない" do
      duplicated = RewardDefinition::BUILTINS.map { |r| r[:image_key] }.compact.tally.select { |_, n| n > 1 }

      expect(duplicated).to be_empty
    end
  end
end
