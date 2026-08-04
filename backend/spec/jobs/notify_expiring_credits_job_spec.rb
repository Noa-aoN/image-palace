require "rails_helper"

RSpec.describe NotifyExpiringCreditsJob do
  let(:user) { create(:user, :confirmed) }
  let(:one) { Billing::POINTS_PER_CREDIT }

  def grant(credits: 5, expires_in: 5.days, remaining: nil, kind: "topup")
    points = credits * one
    user.credit_grants.create!(
      kind: kind, amount_points: points, remaining_points: remaining || points,
      expires_at: expires_in.from_now
    )
  end

  def notifications
    user.notifications.where(kind: "credits_expiring")
  end

  it "7日前の節目で知らせる" do
    target = grant(credits: 5, expires_in: 5.days)

    described_class.perform_now

    expect(notifications.count).to eq(1)
    expect(notifications.first.title).to include("5")
    expect(notifications.first.url).to eq("/billing")
    expect(target.reload.metadata["notified_days"]).to eq([ 7 ])
  end

  it "同じ節目で二度は知らせない" do
    grant(expires_in: 5.days)

    described_class.perform_now
    described_class.perform_now

    expect(notifications.count).to eq(1)
  end

  it "期限が近づいたら、前日の節目でもう一度知らせる" do
    target = grant(expires_in: 5.days)
    described_class.perform_now

    travel_to(4.days.from_now) { described_class.perform_now }

    expect(notifications.count).to eq(2)
    expect(target.reload.metadata["notified_days"]).to contain_exactly(7, 1)
  end

  it "ちょうど節目の境目にあるぶんも取りこぼさない" do
    # 秒まで見ていると、1日と数マイクロ秒後に切れるぶんをどの回も拾えなくなる
    grant(expires_in: 1.day + 1.second)

    described_class.perform_now

    expect(notifications.count).to eq(1)
  end

  it "近い節目と遠い節目の両方に当てはまっても、1回しか鳴らさない" do
    target = grant(expires_in: 12.hours)

    described_class.perform_now

    expect(notifications.count).to eq(1)
    expect(notifications.first.payload["days"]).to eq(1)
    # 遠い節目は済み扱いにする（あとから「残り7日」は送らない）
    expect(target.reload.metadata["notified_days"]).to contain_exactly(1, 7)
  end

  it "まだ先のものには知らせない" do
    grant(expires_in: 30.days)

    described_class.perform_now

    expect(notifications).to be_empty
  end

  it "使い切ったぶんには知らせない" do
    grant(credits: 5, remaining: 0, expires_in: 3.days)

    described_class.perform_now

    expect(notifications).to be_empty
  end

  it "すでに切れたものには知らせない" do
    user.credit_grants.create!(
      kind: "topup", amount_points: 5 * one, remaining_points: 5 * one, expires_at: 1.day.ago
    )

    described_class.perform_now

    expect(notifications).to be_empty
  end

  it "期限の無いぶんには知らせない" do
    user.credit_grants.create!(
      kind: "campaign", amount_points: 5 * one, remaining_points: 5 * one, expires_at: nil
    )

    described_class.perform_now

    expect(notifications).to be_empty
  end

  it "月額プランの当月分には知らせない（毎月鳴ると読まれなくなる）" do
    user.update!(subscription_credits: 5 * one)

    described_class.perform_now

    expect(notifications).to be_empty
  end

  it "端数のあるクレジットも読める形で出す" do
    user.credit_grants.create!(
      kind: "topup", amount_points: 150, remaining_points: 150, expires_at: 3.days.from_now
    )

    described_class.perform_now

    expect(notifications.first.title).to include("1.50")
  end

  it "1件の失敗で残りを止めない" do
    other = create(:user, :confirmed)
    grant(expires_in: 3.days)
    other.credit_grants.create!(
      kind: "topup", amount_points: 5 * one, remaining_points: 5 * one, expires_at: 3.days.from_now
    )
    call_count = 0
    allow(Notifications::CreateService).to receive(:call) do |**args|
      call_count += 1
      raise StandardError, "boom" if call_count == 1

      Notification.create!(user: args[:user], kind: args[:kind], title: args[:title])
    end

    expect { described_class.perform_now }.not_to raise_error
    expect(call_count).to eq(2)
  end

  it "複数人ぶんをまとめて流す" do
    other = create(:user, :confirmed)
    grant(expires_in: 3.days)
    other.credit_grants.create!(
      kind: "topup", amount_points: 5 * one, remaining_points: 5 * one, expires_at: 3.days.from_now
    )

    described_class.perform_now

    expect(user.notifications.where(kind: "credits_expiring").count).to eq(1)
    expect(other.notifications.where(kind: "credits_expiring").count).to eq(1)
  end
end
