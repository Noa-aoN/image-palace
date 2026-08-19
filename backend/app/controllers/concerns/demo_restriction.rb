# frozen_string_literal: true

# 体験用の宮殿で禁じている操作を、入口で止める。
#
# **判定は `DemoPolicy` に1枚だけ置く。** ここは呼ぶだけで、
# 断り方も1つに揃える（押した瞬間に、どこでも同じ言い回しが出る）。
#
#   before_action -> { deny_for_demo!(:billing_checkout) }
#
# 独立した concern にしてあるのは、devise_token_auth 側のコントローラが
# `Api::V1::BaseController` を継がないため。**入口を1つにしておきたい。**
module DemoRestriction
  extend ActiveSupport::Concern

  private

  def deny_for_demo!(capability)
    return if DemoPolicy.allow?(demo_restriction_user, capability)

    render json: {
      error: DemoPolicy.message(capability),
      code: "demo_forbidden"
    }, status: :forbidden
  end

  # 誰を見るか。devise 側は `current_user` を持たない場面があるので、
  # そのときは処理の対象（`@resource`）を見る
  def demo_restriction_user
    return current_user if respond_to?(:current_user) && current_user

    @resource if defined?(@resource)
  end
end
