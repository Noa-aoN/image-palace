# 期限切れの期限付きクレジット（credit_grants）を失効させ、台帳に記録する。
# 残高自体は active スコープで遅延的に正しく出るが、表示・会計の正確性と失効ログのために日次で実行する。
class ExpireCreditGrantsJob < ApplicationJob
  queue_as :default

  def perform(now = Time.current)
    CreditGrant
      .where("expires_at IS NOT NULL AND expires_at <= ? AND remaining_points > 0", now)
      .find_each { |grant| expire!(grant) }
  end

  private

  def expire!(grant)
    grant.user.with_lock do
      grant.reload
      forfeited = grant.remaining_points
      return unless forfeited.positive?

      grant.update!(remaining_points: 0)
      grant.user.credit_transactions.create!(
        kind: "grant_expire",
        delta: -forfeited,
        subscription_credits_after: grant.user.subscription_credits,
        topup_credits_after: grant.user.topup_credits
      )
    end
  end
end
