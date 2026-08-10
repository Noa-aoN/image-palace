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
  # 2. 課金
  #    種類ごとに 1 回あたりのポイントを設定できる（1cr = 100pt なので 1pt = 0.01cr）。
  #    値決めのため当初は全て 0（無料）にしていたが、ai_usages に実績が貯まったので
  #    **一律 1pt = 0.01cr** にした。無料枠の 1cr でも 100 回使える額で、
  #    「AI を使ったのに何も減っていない」状態を無くすことを優先している。
  #    種類ごとの重さの差（トークン量）は、必要になったら ENV で個別に上げる。
  module UsageLimit
    module_function

    # 1日（24時間）あたりの呼び出し上限。0 以下で無効
    DEFAULT_DAILY_CALL_CAP = 300

    # 呼び出し1回あたりの既定コスト（ポイント）。1pt = 0.01cr。
    #
    # 一律にしているのは、種類ごとに差を付ける根拠がまだ無いため。
    # トークン量には数倍の開きがあるが、いずれも画像1枚（100pt）とは桁が違う。
    # 実績を見て重い種類が分かったら、ここか ENV で個別に上げる。
    UNIT_COST_POINTS = 1

    DEFAULT_COST_POINTS = {
      "meaning" => UNIT_COST_POINTS,
      "examples" => UNIT_COST_POINTS,
      "tags" => UNIT_COST_POINTS,
      "brief" => UNIT_COST_POINTS,
      "scene_rewrite" => UNIT_COST_POINTS,
      "fill_properties" => UNIT_COST_POINTS,
      "fact_check" => UNIT_COST_POINTS,
      "words_generate" => UNIT_COST_POINTS,
      "words_check" => UNIT_COST_POINTS,
      "canvas_edit" => UNIT_COST_POINTS,
      "canvas_card_proposal" => UNIT_COST_POINTS
    }.freeze

    def daily_call_cap
      ENV.fetch("AI_DAILY_CALL_CAP", DEFAULT_DAILY_CALL_CAP.to_s).to_i
    end

    # 種類ごとのコスト。ENV（AI_COST_FACT_CHECK=2 など）で上書きできる。
    #
    # 表に無い種類も既定で課金する。無料にしたいときは ENV で明示的に 0 を置くこと。
    # 新しい呼び出しを足して表への追加を忘れると、気づかないまま無料で回り続ける。
    # 取りこぼしより、気づける方に倒す。
    def cost_points(kind)
      from_env = ENV["AI_COST_#{kind.to_s.upcase}"]
      return from_env.to_i if from_env.present?

      DEFAULT_COST_POINTS.fetch(kind.to_s, UNIT_COST_POINTS)
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
