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
      record!(response)
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

    # 記録と課金。ここで転ぶと生成そのものが無駄になるので、失敗してもログだけ残して通す。
    def record!(response)
      usage = response["usage"] || {}
      cost = Ai::UsageLimit.charge!(user: @user, kind: @kind)

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
