# frozen_string_literal: true

# 体験用の宮殿で、何を禁じるか。
#
# **`if user.demo?` を各所に散らさない。** 表を1枚だけ持ち、入口で見る。
#
# ## なぜ「禁じる一覧」なのか
#
# 許す一覧にすると、機能が増えたときに書き足すのを忘れて
# 「体験版だと使えない」が起きる。禁じる一覧なら、忘れたときに増えるのは
# **体験できる範囲**で、事故にはならない。
#
# 危ない側（お金・認証・持ち出し）は数が少なく、増えれば気づける。
# それでも忘れないよう、PR の確認事項にも1行置いてある。
module DemoPolicy
  # 体験用に禁じる能力。ここに無いものは全部できる。
  FORBIDDEN = %i[
    billing_checkout
    billing_portal
    change_email
    change_password
    manage_totp
    manage_passkey
    manage_oauth
    delete_account
    export_data
    import_data
    redeem_code
    generate_image
  ].freeze

  # 説明のための分類。**判定には使わない**（画面で理由を出したいときのため）
  REASONS = {
    billing_checkout: "お支払いに関する操作",
    billing_portal: "お支払いに関する操作",
    change_email: "アカウントに関する操作",
    change_password: "アカウントに関する操作",
    manage_totp: "アカウントに関する操作",
    manage_passkey: "アカウントに関する操作",
    manage_oauth: "アカウントに関する操作",
    delete_account: "アカウントに関する操作",
    export_data: "持ち出しに関する操作",
    import_data: "持ち出しに関する操作",
    redeem_code: "引き換えに関する操作",
    generate_image: "画像の生成"
  }.freeze

  module_function

  # その人が、その能力を使えるか。
  # **体験用でなければ、いつでも true**（普通の利用者には何も影響しない）
  def allow?(user, capability)
    return true unless user.respond_to?(:demo?) && user&.demo?

    FORBIDDEN.exclude?(capability.to_sym)
  end

  def forbid?(user, capability)
    !allow?(user, capability)
  end

  # 断るときの言い方。**どの入口でも同じ言い回しにする**
  def message(capability)
    reason = REASONS[capability.to_sym]
    return "体験版ではこの操作をお使いいただけません。" if reason.blank?

    "体験版では#{reason}をお使いいただけません。"
  end
end
