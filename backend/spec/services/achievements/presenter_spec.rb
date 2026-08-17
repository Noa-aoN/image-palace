require "rails_helper"

RSpec.describe Achievements::Presenter do
  let(:user) { create(:user, :confirmed) }

  def define_mission!(key, cadence:, target: 10, position: 0)
    MissionDefinition.create!(
      key: key, name: key, cadence: cadence, condition_type: "cards_created",
      condition_target: target, position: position, enabled: true, published: true
    )
  end

  def progress!(definition, progress, completed: false)
    UserMission.create!(
      user: user, mission_definition: definition, period_key: definition.period_key(Time.current),
      progress: progress, completed_at: completed ? Time.current : nil
    )
  end

  # エントランスの「位」に絵を出すため、契約に付く位を行ごと返している。
  # **名乗っている称号とは別のもの**なので、名乗りの有無で消えてはいけない
  describe "契約に付く位" do
    def summary_for(u) = described_class.new(u).summary

    it "契約が無ければ市民を返す（絵の場所つき）" do
      rank = summary_for(user)[:rank]

      expect(rank[:key]).to eq("title_rank_free")
      expect(rank[:name]).to eq("市民")
      expect(rank[:image_url]).to be_present
    end

    it "契約している位を返す" do
      plan = Plan.find_or_create_by!(name: "pro") do |p|
        p.assign_attributes(tier: "pro", kind: "subscription", interval: "month",
                            price_cents: 3_980, credits_per_period: 280, active: true)
      end
      Subscription.create!(user: user, plan: plan, status: "active", started_at: 1.day.ago)

      expect(summary_for(user)[:rank][:key]).to eq("title_rank_pro")
    end

    it "何も名乗っていなくても返る（名乗りと位は別のもの）" do
      s = summary_for(user)

      expect(s[:title]).to be_nil
      expect(s[:rank]).to be_present
    end
  end

  describe "ミッションの並びと数" do
    # 既定のミッションが枠を埋めてしまうので、この節では自分で並べたものだけを見る
    before do
      MissionDefinition.registry
      MissionDefinition.update_all(enabled: false)
    end

    it "種別ごとに数を絞る" do
      5.times { |i| define_mission!("daily_#{i}", cadence: "daily", position: i) }

      dailies = described_class.call(user: user)[:missions].select { |m| m[:cadence] == "daily" }

      expect(dailies.size).to eq(described_class::MISSION_LIMITS["daily"])
    end

    it "達成に近い順に並べ、済んだものは下へ落とす" do
      far = define_mission!("far", cadence: "daily", target: 100, position: 1)
      near = define_mission!("near", cadence: "daily", target: 10, position: 2)
      done = define_mission!("done", cadence: "daily", target: 10, position: 3)
      progress!(far, 1)
      progress!(near, 9)
      progress!(done, 10, completed: true)

      dailies = described_class.call(user: user)[:missions].select { |m| m[:cadence] == "daily" }

      expect(dailies.map { |m| m[:key] }).to eq(%w[near far done])
    end

    it "期間限定は数を絞らない（終わってしまうものを隠さない）" do
      5.times { |i| define_mission!("limited_#{i}", cadence: "limited", position: i) }

      limited = described_class.call(user: user)[:missions].select { |m| m[:cadence] == "limited" }

      expect(limited.size).to eq(5)
    end

    it "種別は決まった順に並ぶ" do
      define_mission!("w", cadence: "weekly")
      define_mission!("d", cadence: "daily")
      define_mission!("o", cadence: "onboarding")

      cadences = described_class.call(user: user)[:missions].map { |m| m[:cadence] }.uniq

      expect(cadences.index("onboarding")).to be < cadences.index("daily")
      expect(cadences.index("daily")).to be < cadences.index("weekly")
    end
  end
end
