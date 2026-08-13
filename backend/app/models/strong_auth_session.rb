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

  # 確かめ直しを求めるまでの猶予。**用途で長さを分ける。**
  #
  # 危険操作（役割の変更・パスキーの削除・二要素の解除）は、通ったあと
  # すぐに効いてしまうもの。ここは短いままにする。長くすると、席を外した隙に
  # 操作できてしまう。
  #
  # 執務室に居ること自体は、それだけでは何も壊さない。読んで回るだけの時間が
  # 長いのに10分で追い出すと、**確かめ直しが作業の邪魔にしかならず、
  # 「とりあえず通す」癖がつく**。守りとして働かなくなる方が危うい。
  #
  # 執務室は1時間。数字を読んで、利用者を見て、記録を追う、という一続きの作業は
  # 30分では終わらないことが多い。途中で追い出されると、確かめ直しが
  # 「作業を再開するための儀式」になり、意味が薄れる。
  # **入口を広げても、危険操作は入口とは別に10分で確かめ直す**ので、
  # 手前が緩んだぶん奥が緩むことはない。
  #
  # どちらも同じ記録（この端末が確かめた時刻）を見て、見る窓の広さだけが違う。
  WINDOW = 10.minutes
  ADMIN_WINDOW = 1.hour

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

  # この端末は、まだ猶予の中にいるか。
  # within を渡さなければ危険操作の猶予（短い方）で見る。**広い方は明示的に選ぶ**
  def self.fresh?(user:, client_id:, within: WINDOW)
    return false if user.nil? || client_id.blank?

    exists?(user: user, client_id: client_id, authenticated_at: within.ago..)
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
