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
