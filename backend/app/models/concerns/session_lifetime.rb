# frozen_string_literal: true

# セッションの**絶対上限**。
#
# トークンの寿命（`TOKEN_LIFESPAN_DAYS`、既定7日）は
# リクエストのたびに延びるので、使い続けている限り切れない。
# つまり「7日**使わなければ**入り直し」という意味しかなく、
# 置き忘れた端末や持ち出されたトークンには効かない。
#
# ここは別の物差し。**始まってから何日経ったか**で切る。
# 使っていても、上限を過ぎたら必ず入り直してもらう。
module SessionLifetime
  extend ActiveSupport::Concern

  # 上限。**0 を渡せば止まる**（デプロイせずに切れるようにしておく）。
  #
  # 30日は、消費者向けの製品でよくある長さ。ここは学習の道具で、
  # 毎日開く人もいれば週末だけの人もいる。短すぎると、
  # 覚えたい語を書き留めようとしたところで入り直しを求めることになる。
  def self.max_days
    @max_days ||= ENV.fetch("SESSION_MAX_DAYS", "30").to_i
  end

  def self.enabled? = max_days.positive?

  # そのセッションが始まった時刻。**まだ知らなければ、いま始まったことにする。**
  #
  # 既にログインしている人の記録は無いので、「無い＝古い」と扱うと
  # デプロイした瞬間に全員が締め出される。初めて見たときから数える。
  def session_started_at(client)
    return nil if client.blank?

    stored = session_starts[client]
    return Time.zone.parse(stored) if stored.present?

    touch_session_start!(client)
    Time.current
  end

  # 上限を過ぎているか。止めているときは常に false
  def session_expired?(client)
    return false unless SessionLifetime.enabled?

    started = session_started_at(client)
    started.present? && started < SessionLifetime.max_days.days.ago
  end

  # その端末を締め出す。**トークンごと落とす**（次から 401 になる）
  def end_session!(client)
    return if client.blank?

    tokens.delete(client)
    session_starts.delete(client)
    save!(validate: false)
  end

  private

  def touch_session_start!(client)
    # 使われなくなった端末の記録は、ここで一緒に落とす
    # （トークンが消えた端末の分が、いつまでも残らないように）
    session_starts.slice!(*tokens.keys) if tokens.present?
    session_starts[client] = Time.current.iso8601
    save!(validate: false)
  end
end
