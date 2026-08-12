# frozen_string_literal: true

# 強い確認を通った端末。
#
# **「その人が最近確かめたか」ではなく「この端末が最近確かめたか」**を見る。
# 利用者の列に一つ持たせると、机のパソコンで確かめた結果が、
# 置き忘れた携帯にも効いてしまう。
#
# 危険操作の側は、どの方法で確かめたかを知らない。
# Passkey でも認証アプリでも復旧コードでも、ここに収束させる。
class StrongAuthSession < ApplicationRecord
  belongs_to :user

  # 確かめ直しを求めるまでの猶予。
  #
  # 長いと、席を外した隙に操作できてしまう。短いと、権限をいくつか続けて
  # 変えるだけで何度も求められる。**続けて数手できて、離席には間に合わない**
  # ところとして10分に置く。
  WINDOW = 10.minutes

  METHODS = %w[passkey totp recovery_code].freeze

  validates :client_id, presence: true
  validates :authenticated_at, presence: true

  # 通ったことを記録する。同じ端末なら上書き（何度も行を増やさない）
  def self.record!(user:, client_id:, method:)
    return nil if client_id.blank?

    session = find_or_initialize_by(user: user, client_id: client_id)
    session.update!(authenticated_at: Time.current, method: method)
    session
  end

  # この端末は、まだ猶予の中にいるか
  def self.fresh?(user:, client_id:)
    return false if user.nil? || client_id.blank?

    exists?(user: user, client_id: client_id, authenticated_at: WINDOW.ago..)
  end

  # 端末を手放したときに消す（ログアウト・鍵の取り消しなど）
  def self.revoke!(user:, client_id: nil)
    scope = where(user: user)
    scope = scope.where(client_id: client_id) if client_id
    scope.delete_all
  end

  # 猶予を過ぎた行の掃除。放っておくと増え続ける
  def self.sweep!(older_than: 1.day.ago)
    where(authenticated_at: ...older_than).delete_all
  end
end
