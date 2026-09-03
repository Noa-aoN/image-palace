# frozen_string_literal: true

# 運営の仕事のための予算。
#
# 公式の絵を作るのに、**その人の買い物として払わせない**。
# 運営の仕事であって、個人の支出ではない。
#
# ## ただし、財布は分けない
#
# 以前はここが**別の財布**で、運営の生成だけ残高を通らずに引かれていた。
# 結果として運営の残高は1点も動かず、
#   ・クレジットの数え方が壊れても気づけない（現に気づけなかった）
#   ・自分がどれだけ使っているのかも分からない
# という状態になっていた。
#
# いまは**執務室から自分の残高へ入れる**形にしてある。
# 入れたあとは普通のクレジットとまったく同じに減るので、
# 数え方の不具合も使いすぎも、他の利用者と同じ画面で見える。
#
# ## それでも上限は置く
#
# 無制限にすると、間違いや暴走がそのまま費用になる。
# 「1か月にここまで」を置いて、**近づいたら気づける**ようにする。
#
#     運営クレジット  今月 37 / 500 cr
#
# 原価は別に記録されている（`image_usages` / `ai_usages`）ので、
# **入れたぶんが実際いくらになったか**は今までどおり見える。
module StudioAllowance
  extend ActiveSupport::Concern

  class OverAllowance < StandardError; end

  # 枠の大きさは付与ポリシーが持つ。**運営画面から変えられる。**
  #
  # 既定の 500cr は、公式コンテンツを1から作り直しても届かない大きさ。
  # 足りなければ、デプロイ無しで上げられる
  POLICY_KEY = "studio_allowance"

  # 入れたクレジットの種類。履歴で出どころが分かるようにする
  GRANT_KIND = "ops"

  # 入れたクレジットの寿命。
  # **運営の予算なので、持ち越して積み上がらないようにする**（月ごとに使い切る）
  GRANT_VALID_DAYS = 60

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

  # 今月すでに引き出したぶん
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

  # その量を今月まだ引き出せるか
  def studio_allowance_covers?(amount)
    studio_allowance? && studio_allowance_remaining_points >= amount
  end

  # 運営の予算から、自分の残高へ入れる。
  #
  # **入れたあとは普通のクレジット。** 減り方も、履歴の出かたも、他の人と同じ。
  # 引き出した記録（studio_usages）は月ごとの上限を数えるために残す。
  def draw_studio_allowance!(points, reason:)
    raise OverAllowance, "今月の運営クレジットの上限を超えます" unless studio_allowance_covers?(points)

    with_lock do
      studio_usages.create!(cost_points: points, kind: "draw")
      credit_grants.create!(
        kind: GRANT_KIND,
        amount_points: points,
        remaining_points: points,
        expires_at: GRANT_VALID_DAYS.days.from_now,
        metadata: { reason: reason }
      )
      record_credit!(kind: "grant", delta: points)
    end
  end
end
