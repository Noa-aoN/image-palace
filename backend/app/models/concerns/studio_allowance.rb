# frozen_string_literal: true

# 公式コンテンツを作るための枠。
#
# 公式の絵を作るのに、**買ったクレジットを使わせない**。
# 運営の仕事であって、その人の買い物ではない。
#
# ## それでも上限は置く
#
# 無制限にすると、間違いや暴走がそのまま費用になる。
# 「使い切らない大きさ」を置いて、**近づいたら気づける**ようにする。
#
#     公式制作枠  37 / 500 cr
#
# ## 通常のクレジットには手を触れない
#
# 残高の勘定（`credit_grants` / `subscription_credits` / `topup_credits`）は
# そのまま。ここは**消費の手前で分岐する**だけなので、
# 買った人の残高も、売上の集計も、1円も動かない。
#
# 原価は別に記録されている（`image_usages` / `ai_usages`）ので、
# **枠で作ったぶんの費用は今までどおり見える**。
module StudioAllowance
  extend ActiveSupport::Concern

  # 枠の大きさは付与ポリシーが持つ。**運営画面から変えられる。**
  #
  # 既定の 500cr は、公式コンテンツを1から作り直しても届かない大きさ。
  # 足りなければ、デプロイ無しで上げられる
  POLICY_KEY = "studio_allowance"

  # 使った量を数える窓。**月ごとに戻す**（使い切りにしない）
  def self.period_start(now = Time.current)
    now.beginning_of_month
  end

  included do
    has_many :studio_usages, dependent: :destroy
  end

  # 枠を持っているか。**公式コンテンツを作れる人だけ**
  def studio_allowance?
    can_edit_official_content?
  end

  # 枠の上限（ポイント）。運営が変えられる
  def studio_allowance_limit_points
    GrantPolicy.amount_for(POLICY_KEY) * Billing::POINTS_PER_CREDIT
  end

  # 今月すでに使ったぶん
  def studio_allowance_used_points(now: Time.current)
    studio_usages.where(created_at: StudioAllowance.period_start(now)..).sum(:cost_points)
  end

  def studio_allowance_remaining_points(now: Time.current)
    [ studio_allowance_limit_points - studio_allowance_used_points(now: now), 0 ].max
  end

  # 画面へ渡す形
  def studio_allowance_summary(now: Time.current)
    return nil unless studio_allowance?

    used = studio_allowance_used_points(now: now)
    limit = studio_allowance_limit_points
    {
      used_credits: used.fdiv(Billing::POINTS_PER_CREDIT),
      limit_credits: limit.fdiv(Billing::POINTS_PER_CREDIT),
      remaining_credits: [ limit - used, 0 ].max.fdiv(Billing::POINTS_PER_CREDIT),
      period_start: StudioAllowance.period_start(now)
    }
  end

  # その支払いを、枠で賄うか。
  #
  # **枠を持っていて、今月ぶんが残っているときだけ。**
  # 使い切ったら普通のクレジットへ戻る（作業が止まるより、
  # 気づいてから上げてもらうほうがよい）
  def studio_allowance_covers?(amount)
    studio_allowance? && studio_allowance_remaining_points >= amount
  end

  # 枠から使う。**買ったクレジットは減らない**
  def consume_studio_allowance!(amount, kind:, item: nil)
    studio_usages.create!(cost_points: amount, kind: kind, item: item)
  end
end
