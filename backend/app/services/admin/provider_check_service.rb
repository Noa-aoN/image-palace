# frozen_string_literal: true

module Admin
  # OpenAI が「いま」応じるかを最小の呼び出しで確かめる。
  #
  # 残高そのものは API から読めない（照会の口が無く、管理画面でしか見えない）。
  # 実際に1回叩いて、残高切れなら返ってくる insufficient_quota で判定する。
  # モデル一覧（/v1/models）は残高が空でも通るため、判定には使えない。
  #
  # 使うトークンは1未満で、費用は無視できる。押した人にだけ走る。
  class ProviderCheckService
    include ImageGenerationErrorHandling

    PROBE_MODEL = "gpt-4o-mini"
    TIMEOUT = 15

    Result = Struct.new(:ok, :code, :message, keyword_init: true)

    def self.call = new.call

    def call
      client.chat(
        parameters: {
          model: PROBE_MODEL,
          messages: [ { role: "user", content: "ping" } ],
          max_tokens: 1
        }
      )
      Result.new(ok: true)
    rescue StandardError => e
      # 残高切れならここで記録される（管理画面の「供給側の状態」に出る）
      notify_quota_exhausted(e) if quota_error?(e)

      Result.new(ok: false, code: openai_error_codes(e).first || e.class.name, message: redact(e.message))
    end

    private

    def client
      ::OpenAI::Client.new(access_token: api_key, request_timeout: TIMEOUT)
    end

    def api_key
      ENV.fetch("OPENAI_API_KEY")
    end

    # 例外メッセージに鍵が混ざる経路を塞ぐ（画面にもログにも出さない）
    def redact(message)
      key = ENV["OPENAI_API_KEY"].to_s
      text = message.to_s
      text = text.gsub(key, "[REDACTED]") if key.present?
      text[0, 300]
    end
  end
end
