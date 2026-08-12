# frozen_string_literal: true

# 登録した鍵（Passkey / セキュリティキー）。
#
# **1人が何本でも持てる。** 1本しか登録できないと、その端末を失った時点で
# 入れなくなる。機種変更のときも、新しい端末を足してから古いものを外せる。
#
# 公開鍵しか持たない。秘密鍵は認証器の中から出てこないので、
# こちらの DB が漏れても、なりすましには使えない。
class WebauthnCredential < ApplicationRecord
  belongs_to :user

  validates :external_id, presence: true, uniqueness: true
  validates :public_key, presence: true
  validates :nickname, length: { maximum: 50 }

  scope :recent, -> { order(last_used_at: :desc, created_at: :desc) }

  # 名前を付けていない鍵は、いつ登録したかで見分ける
  def display_name
    nickname.presence || "#{created_at.strftime('%Y/%m/%d')} に登録した鍵"
  end

  # 使ったことを記録する。
  #
  # sign_count の扱いは webauthn gem に任せる（verify に渡した値と
  # 突き合わせるのは gem の仕事）。**こちらで独自の判定を足さない。**
  # 同期する Passkey は複数の端末で使われ、数え方が実装によって違う。
  # 素朴に「増えていなければ複製」と決めつけると、正規の利用者を弾く。
  def touch_usage!(sign_count)
    update!(sign_count: sign_count, last_used_at: Time.current)
  end
end
