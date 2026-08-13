require "rails_helper"

# 継続率（D1 / D7 / D30）。
#
# 登録日の N 日後「ぴったり」その日に活動したかで数える。
# **測り始めた日より前は「未計測」で、0% ではない。** 推定で埋めない。
RSpec.describe "継続率" do
  let(:now) { Time.zone.local(2026, 9, 30, 12) }
  let(:started_on) { Date.new(2026, 8, 1) }

  def retention(period: "1y")
    travel_to(now) { Admin::BusinessMetricsService.call(now: now, period: period) }[:activity_retention]
  end

  # 登録して、指定した経過日に活動した人を作る
  def user_registered(days_ago:, active_on: [])
    user = create(:user, :confirmed)
    user.update_column(:created_at, now - days_ago.days)
    active_on.each { |offset| UserActivityDay.record!(user.id, (now - days_ago.days + offset.days).to_date) }
    user
  end

  describe "測る前" do
    it "記録が1件も無ければ、0% ではなく「まだ出せない」と返す" do
      user_registered(days_ago: 40)

      result = retention

      expect(result[:measurement_started_on]).to be_nil
      expect(result[:days][:d1][:mature]).to be(false)
      expect(result[:days][:d1][:rate]).to be_nil
    end
  end

  describe "D1" do
    it "登録の翌日に活動した人の割合" do
      user_registered(days_ago: 10, active_on: [ 0, 1 ]) # 戻ってきた
      user_registered(days_ago: 10, active_on: [ 0 ])    # 戻ってこなかった

      d1 = retention[:days][:d1]

      expect(d1[:cohort]).to eq(2)
      expect(d1[:returned]).to eq(1)
      expect(d1[:rate]).to eq(50.0)
    end

    it "翌々日に来ても D1 には数えない（その日ぴったりで見る）" do
      user_registered(days_ago: 10, active_on: [ 0, 2 ])

      expect(retention[:days][:d1][:returned]).to eq(0)
    end

    it "まだ1日経っていない人は母数に入れない" do
      user_registered(days_ago: 10, active_on: [ 0, 1 ])
      user_registered(days_ago: 0, active_on: [ 0 ]) # 今日登録

      expect(retention[:days][:d1][:cohort]).to eq(1)
    end
  end

  describe "D7 / D30" do
    it "登録の7日後・30日後ぴったりで見る" do
      user_registered(days_ago: 40, active_on: [ 0, 7, 30 ])
      user_registered(days_ago: 40, active_on: [ 0, 7 ])

      days = retention[:days]

      expect(days[:d7][:returned]).to eq(2)
      expect(days[:d30][:returned]).to eq(1)
      expect(days[:d30][:rate]).to eq(50.0)
    end

    it "30日経っていない人は D30 の母数に入れない（未成熟を混ぜない）" do
      user_registered(days_ago: 40, active_on: [ 0, 30 ])
      user_registered(days_ago: 10, active_on: [ 0 ])

      days = retention[:days]

      expect(days[:d30][:cohort]).to eq(1)
      expect(days[:d30][:rate]).to eq(100.0)
    end
  end

  describe "測り始めた日より前" do
    it "その日を測っていない人は母数に入れない（来なかったのか測っていないのか分からない）" do
      # 測り始めたのが 8/1。この人の D30 は 7/11 で、記録が無い期間
      old = create(:user, :confirmed)
      old.update_column(:created_at, Time.zone.local(2026, 6, 11))
      # 測定開始の目印として、別の人の記録を 8/1 に置く
      recent = user_registered(days_ago: 40, active_on: [ 0, 30 ])
      UserActivityDay.record!(recent.id, started_on)

      days = retention[:days]

      expect(days[:d30][:cohort]).to eq(1)
      expect(retention[:measurement_started_on]).to eq(started_on)
    end
  end

  describe "母数が空のとき" do
    it "0% ではなく「まだ出せない」" do
      user_registered(days_ago: 1, active_on: [ 0 ]) # 記録はあるが D30 は未成熟

      d30 = retention[:days][:d30]

      expect(d30[:mature]).to be(false)
      expect(d30[:rate]).to be_nil
    end
  end

  describe "問い合わせの本数" do
    it "人が増えても増えない" do
      3.times { user_registered(days_ago: 40, active_on: [ 0, 1, 7, 30 ]) }
      count = 0
      sub = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
        count += 1 unless payload[:name].to_s.match?(/SCHEMA|TRANSACTION/)
      end
      travel_to(now) { Admin::BusinessMetricsService.new(now, Admin::Period.resolve("1y", now: now)).send(:activity_retention) }
      ActiveSupport::Notifications.unsubscribe(sub)

      # 測定開始日1本 + D1/D7/D30 でそれぞれ母数と戻りの2本 = 7本
      expect(count).to be <= 8
    end
  end
end
