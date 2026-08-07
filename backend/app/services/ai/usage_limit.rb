# frozen_string_literal: true

module Ai
  # 文章生成の上限と課金。
  #
  # 方針は2段構え。
  #
  # 1. 安全弁（既定で有効）
  #    事故（無限ループ・自動化・連打）で青天井にならないための1日の回数上限。
  #    商品としての制限ではないので、普通に使う限り当たらない値にする。
  #
  # 2. 課金（既定は無料）
  #    種類ごとに 1 回あたりのポイントを設定できる（1cr = 100pt なので 1pt = 0.01cr）。
  #    実際にいくら掛かっているかは ai_usages に貯まるので、それを見てから値を決められるよう
  #    既定は全て 0 にしてある。ENV で有効にすると、その時点から課金が始まる。
  module UsageLimit
    module_function

    # 1日（24時間）あたりの呼び出し上限。0 以下で無効
    DEFAULT_DAILY_CALL_CAP = 300

    # 種類ごとの既定コスト（ポイント）。実測を見てから決めるため、いまは全て無料
    DEFAULT_COST_POINTS = {
      "meaning" => 0,
      "tags" => 0,
      "brief" => 0,
      "scene_rewrite" => 0,
      "fill_properties" => 0,
      "fact_check" => 0,
      "words_generate" => 0,
      "words_check" => 0,
      # キャンバス編集は何度でも押せて、渡す中身も他より大きい。
      # ここだけは既定で有料にする（1pt = 0.01cr）
      "canvas_edit" => 1
    }.freeze

    def daily_call_cap
      ENV.fetch("AI_DAILY_CALL_CAP", DEFAULT_DAILY_CALL_CAP.to_s).to_i
    end

    # 種類ごとのコスト。ENV（AI_COST_FACT_CHECK=1 など）で上書きできる
    def cost_points(kind)
      from_env = ENV["AI_COST_#{kind.to_s.upcase}"]
      return from_env.to_i if from_env.present?

      DEFAULT_COST_POINTS.fetch(kind.to_s, 0)
    end

    # 呼び出してよいかを確かめる。駄目なら LimitExceeded を投げる
    def ensure_allowed!(user:, kind:)
      return if user.nil?

      ensure_under_daily_cap!(user)
      ensure_enough_credits!(user, kind)
    end

    # 課金する。消費したポイントを返す（無料なら 0）
    def charge!(user:, kind:)
      cost = cost_points(kind)
      return 0 if user.nil? || cost <= 0

      user.consume_credits!(cost)
      cost
    end

    def ensure_under_daily_cap!(user)
      cap = daily_call_cap
      return if cap <= 0
      return if AiUsage.where(user_id: user.id).since(24.hours.ago).count < cap

      raise Chat::LimitExceeded, "AI の利用が1日の上限に達しました。時間を置いてお試しください。"
    end

    def ensure_enough_credits!(user, kind)
      cost = cost_points(kind)
      return if cost <= 0

      user.ensure_current_period_credits!
      return if user.available_credit_points >= cost

      raise Chat::LimitExceeded, "クレジットが不足しています"
    end
  end
end
