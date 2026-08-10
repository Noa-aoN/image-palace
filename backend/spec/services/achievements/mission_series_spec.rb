require "rails_helper"

RSpec.describe "ミッションのシリーズ" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "word") { |t| t.label = "単語" } }

  before do
    # 既定のミッションは邪魔になるので、この spec では自分で並べたものだけを見る
    MissionDefinition.registry
    MissionSeries.registry
    MissionDefinition.update_all(enabled: false)
    MissionSeries.update_all(enabled: false)
  end

  let!(:series) do
    MissionSeries.create!(key: "test_road", name: "試しの道", position: 1, enabled: true, published: true)
  end

  def step!(number, target)
    MissionDefinition.create!(
      key: "step_#{number}", name: "第#{number}段", cadence: "onboarding",
      mission_series: series, series_step: number, position: 100 + number,
      condition_type: "cards_created", condition_target: target,
      enabled: true, published: true
    )
  end

  def make_cards(count)
    count.times { |i| user.items.create!(title: "語#{i}", item_type: item_type) }
  end

  describe "開き方" do
    it "前の段が済むまで、次の段の行を作らない" do
      step!(1, 1)
      step!(2, 100) # ここで止まる
      step!(3, 1)   # 条件は満たしているが、第2段が済むまで開かない
      make_cards(1)

      Achievements::Evaluator.call(user: user)

      # 開いたところまで（済んだ第1段と、いま挑む第2段）しか行を作らない
      keys = UserMission.where(user: user).joins(:mission_definition).pluck("mission_definitions.key")
      expect(keys).to contain_exactly("step_1", "step_2")
    end

    it "既に条件を満たしていれば、同じ回で先の段まで進む" do
      step!(1, 1)
      step!(2, 3)
      step!(3, 1000)
      make_cards(5)

      Achievements::Evaluator.call(user: user)

      completed = UserMission.where(user: user).where.not(completed_at: nil)
                             .joins(:mission_definition).pluck("mission_definitions.key")
      expect(completed).to contain_exactly("step_1", "step_2")
    end
  end

  describe "見せ方" do
    it "いま挑んでいる段を前に出し、道のり全体も返す" do
      step!(1, 1)
      step!(2, 100)
      make_cards(1)
      Achievements::Evaluator.call(user: user)

      road = Achievements::Presenter.call(user: user)[:mission_series].find { |s| s[:key] == "test_road" }

      expect(road[:total_steps]).to eq(2)
      expect(road[:completed_steps]).to eq(1)
      expect(road[:current][:key]).to eq("step_2")
      expect(road[:steps].map { |s| s[:state] }).to eq(%w[done current])
    end

    it "全段が済んだら、いま挑む段は無くなる" do
      step!(1, 1)
      make_cards(1)
      Achievements::Evaluator.call(user: user)

      road = Achievements::Presenter.call(user: user)[:mission_series].find { |s| s[:key] == "test_road" }

      expect(road[:current]).to be_nil
      expect(road[:completed_steps]).to eq(road[:total_steps])
    end

    it "シリーズの段は、単発のミッションの一覧には出さない" do
      step!(1, 1)
      MissionDefinition.create!(
        key: "solo", name: "単発", cadence: "daily", condition_type: "cards_created",
        condition_target: 1, enabled: true, published: true
      )

      page = Achievements::Presenter.call(user: user)

      expect(page[:missions].map { |m| m[:key] }).to contain_exactly("solo")
    end
  end
end
