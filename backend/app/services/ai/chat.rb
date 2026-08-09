# frozen_string_literal: true

module Ai
  # 文章生成の呼び出し口をひとつにまとめる。
  #
  # 各サービスが直接 OpenAI::Client を組み立てていたため、
  #   ・誰が何回呼んでいるのか
  #   ・どのモデルにいくら掛かっているのか
  # がどこにも残っていなかった。ここを通せば、記録も上限も課金も1箇所で扱える。
  #
  # 応答は生のハッシュをそのまま返す。呼び出し側の解析は変えない。
  class Chat
    # 上限に達したときに投げる。呼び出し側は利用者向けの文面に変えて返す
    class LimitExceeded < StandardError; end

    DEFAULT_TIMEOUT = 30

    def self.call(kind:, model:, messages:, user: nil, **options)
      new(kind:, model:, messages:, user:, **options).call
    end

    def initialize(kind:, model:, messages:, user: nil, **options)
      @kind = kind.to_s
      @model = model
      @messages = messages
      @user = user
      @options = options
    end

    def call
      Ai::UsageLimit.ensure_allowed!(user: @user, kind: @kind)

      response = client.chat(parameters: parameters)
      record!(response, charge!)
      response
    end

    private

    def client
      ::OpenAI::Client.new(
        access_token: ENV.fetch("OPENAI_API_KEY"),
        request_timeout: @options.fetch(:request_timeout, DEFAULT_TIMEOUT)
      )
    end

    def parameters
      { model: @model, messages: @messages }.merge(@options.except(:request_timeout))
    end

    # 課金。呼び出す前に ensure_allowed! で残高を見ているので、ここまで来て落ちるのは
    # 同時実行で残高が減った場合くらい。そのときも生成は返す（API 代は既に払っていて、
    # 利用者は結果を受け取っている）。取りこぼしはログと ai_usages の 0pt に残る。
    #
    # 記録と分けているのは、以前ここが記録と同じ rescue の中にあり、
    # **課金が落ちると記録ごと消えて**、取りこぼしたことすら分からなかったため。
    def charge!
      Ai::UsageLimit.charge!(user: @user, kind: @kind)
    rescue StandardError => e
      Rails.logger.warn "[Ai::Chat] CHARGE FAILED kind=#{@kind} user_id=#{@user&.id} #{e.class}: #{e.message}"
      0
    end

    # 記録。ここで転んでも生成そのものは無駄にしない（ログだけ残して通す）。
    def record!(response, cost)
      usage = response["usage"] || {}

      AiUsage.create!(
        user: @user,
        kind: @kind,
        model: @model,
        prompt_tokens: usage["prompt_tokens"].to_i,
        completion_tokens: usage["completion_tokens"].to_i,
        cost_points: cost,
        created_at: Time.current
      )
    rescue StandardError => e
      Rails.logger.warn "[Ai::Chat] RECORD FAILED kind=#{@kind} #{e.class}: #{e.message}"
    end
  end
end
