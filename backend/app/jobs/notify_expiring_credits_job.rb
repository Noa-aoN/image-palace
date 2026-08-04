# frozen_string_literal: true

# 期限が近いクレジットをお知らせする。
#
# 買い切りは実際にお金を払っている。黙って消すのは誠実ではない。
# 気づいて使う機会を、消える前に必ず1度は渡す。
#
# 月額プランの当月分は毎月補充されるので知らせない。
# 毎月鳴るお知らせは読まれなくなり、本当に伝えたい時に届かなくなる。
class NotifyExpiringCreditsJob < ApplicationJob
  queue_as :default

  # 何日前に知らせるか
  THRESHOLDS_IN_DAYS = [ 7, 1 ].freeze

  def perform(now = Time.current)
    CreditGrant.includes(:user)
               .where("remaining_points > 0")
               .where(expires_at: now..horizon(now))
               .find_each { |grant| notify_if_due(grant, now) }
  end

  private

  # いちばん遠い節目まで見る
  def horizon(now)
    (now + THRESHOLDS_IN_DAYS.max.days).end_of_day
  end

  def notify_if_due(grant, now)
    days = threshold_for(grant, now)
    return if days.nil?
    return if notified?(grant, days)

    notify!(grant, days)
  end

  # 当てはまる節目のうち、いちばん近いもの。
  #
  # 「残り◯日」は日の単位で見る。秒まで見ると、ちょうど境目にあるぶん
  # （例: 1日と0.5秒後に切れる）をどの回も拾えず、一度も知らせないまま失効させてしまう。
  def threshold_for(grant, now)
    THRESHOLDS_IN_DAYS.sort.find { |days| grant.expires_at <= (now + days.days).end_of_day }
  end

  # 同じ節目で二度知らせない。どこまで知らせたかはグラント自身に持たせる
  def notified?(grant, days)
    Array(grant.metadata["notified_days"]).include?(days)
  end

  def notify!(grant, days)
    credits = grant.remaining_points.fdiv(Billing::POINTS_PER_CREDIT)
    Notifications::CreateService.call(
      user: grant.user,
      kind: "credits_expiring",
      title: "クレジット #{format_credits(credits)} の期限が近づいています",
      body: "#{I18n.l(grant.expires_at.to_date, format: :long)} に期限を迎えます。",
      url: "/billing",
      payload: { "grant_id" => grant.id, "days" => days, "credits" => credits }
    )
    mark_notified!(grant, days)
  rescue StandardError => e
    # 1件の失敗で残りを止めない。知らせられなかったこと自体は記録に残す
    Rails.logger.error "[NotifyExpiringCreditsJob] FAILED grant_id=#{grant.id} #{e.class}: #{e.message}"
  end

  # この節目と、それより遠い節目をまとめて済みにする。
  # 「残り1日」を知らせたあとに「残り7日」を送るのはおかしいため。
  def mark_notified!(grant, days)
    handled = THRESHOLDS_IN_DAYS.select { |threshold| threshold >= days }
    notified = Array(grant.metadata["notified_days"]) | handled
    grant.update!(metadata: grant.metadata.merge("notified_days" => notified))
  end

  # 端数があるものだけ小数で見せる（0.01cr 単位の消費があるため）
  def format_credits(value)
    value == value.to_i ? value.to_i.to_s : format("%.2f", value)
  end
end
