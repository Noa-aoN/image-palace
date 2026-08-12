# frozen_string_literal: true

# WebAuthn の challenge。
#
# サーバーが「この文字列に署名してみせろ」と渡し、次のリクエストで
# 同じものが返ってきたかを照らす。**短命で、1回きり**でなければ意味がない。
# 使い回せると、盗み見た応答をそのまま送り直せてしまう（リプレイ）。
#
# Rails.cache に置かない。本番のキャッシュはマシンのローカルディスクで、
# 他のマシンから見えない。app 機を2台にした瞬間、challenge を配った機と
# 検証する機が食い違って認証が通らなくなる。
class WebauthnChallenge < ApplicationRecord
  belongs_to :user, optional: true

  # 何のための challenge か。登録用を認証に使い回されないよう分ける
  PURPOSES = %w[registration authentication reauthentication].freeze

  # 2分。認証器に触れるまでの時間としては十分で、
  # 盗まれたものが使える時間は短いほどよい
  TTL = 2.minutes

  validates :challenge, presence: true
  validates :purpose, inclusion: { in: PURPOSES }

  scope :usable, -> { where(consumed_at: nil).where(expires_at: Time.current..) }

  # 実際の登録・認証では、gem が作った options の challenge をそのまま預ける。
  # ここで別に作ると、ブラウザへ渡した値と控えた値が食い違う
  def self.issue!(purpose:, challenge: generate_challenge, user: nil)
    create!(user: user, purpose: purpose, challenge: challenge, expires_at: TTL.from_now)
  end

  # 単体で使う challenge（再認証など、options を作らない場面）。
  # 長さと符号化は gem の作法に合わせる
  def self.generate_challenge
    WebAuthn.configuration.encoder.encode(SecureRandom.random_bytes(32))
  end

  # 使う。**同じ challenge を二度成功させない。**
  #
  # 判定してから更新する書き方だと、同時に2つ来たときに両方が
  # 「まだ使われていない」を見て、両方とも通る。UPDATE の WHERE で
  # 「まだ使われていない」を条件にし、**1行更新できた側だけ**を成功にする。
  # 更新できた行数はデータベースが数えるので、割り込む隙がない。
  def self.consume!(challenge:, purpose:, user: nil)
    scope = usable.where(challenge: challenge, purpose: purpose)
    scope = scope.where(user_id: user.id) if user

    record = scope.first
    return nil if record.nil?

    # 取り出したあと、条件付きで1行だけ落とす
    updated = usable.where(id: record.id).update_all(consumed_at: Time.current)
    updated == 1 ? record : nil
  end

  # 期限切れの掃除。放っておくと行が増え続ける
  def self.sweep!(older_than: 1.day.ago)
    where(expires_at: ...older_than).delete_all
  end
end
