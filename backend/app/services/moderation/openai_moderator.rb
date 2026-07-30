# frozen_string_literal: true

module Moderation
  # OpenAI Moderation API（無料）でユーザー入力を検査する。
  #
  # 自作ブロックリスト（PromptModerator）は言い換え・難読化に無力なため、その2段目として使う。
  #
  # 方針:
  # - `flagged` をそのまま使わない。学習アプリでは「戦争」「麻薬」のような学習語が
  #   violence / illicit で拾われるため、**ブロックするカテゴリを限定**する
  # - スコアが THRESHOLD を超えたときのみブロックする（弱い反応で弾かない）
  # - API 障害・タイムアウトは **fail-open**（通す）。可用性を優先し、監査ログだけ残す。
  #   画像生成 API 側にも content policy 拒否のハンドリングがあるため二重の網になっている
  class OpenaiModerator
    MODEL = "omni-moderation-latest"
    # 学習用途で正当になりにくいカテゴリのみを対象にする
    BLOCKED_CATEGORIES = %w[
      sexual/minors
      sexual
      hate/threatening
      harassment/threatening
      self-harm/instructions
      violence/graphic
    ].freeze
    THRESHOLD = 0.5
    REQUEST_TIMEOUT_SECONDS = 3

    Result = Struct.new(:allowed, :category, :score, keyword_init: true) do
      def allowed?
        allowed
      end
    end

    def self.enabled?
      # テスト環境では既定オフ（外部 API に触れない）。明示的に有効化したテストだけが通る。
      default = Rails.env.test? ? "false" : "true"
      ENV.fetch("OPENAI_MODERATION_ENABLED", default) == "true" && ENV["OPENAI_API_KEY"].present?
    end

    def self.call(text)
      new(text).call
    end

    def initialize(text)
      @text = text.to_s
    end

    def call
      return Result.new(allowed: true) if @text.blank? || !self.class.enabled?

      scores = request_scores
      category, score = worst_blocked(scores)
      return Result.new(allowed: true) if category.nil?

      Result.new(allowed: false, category: category, score: score)
    rescue StandardError => e
      # 検査できなかったことを理由にサービスを止めない（fail-open）
      Rails.logger.warn("[Moderation] OpenAI Moderation を実行できませんでした: #{e.class}: #{e.message}")
      Result.new(allowed: true)
    end

    private

    def request_scores
      client = ::OpenAI::Client.new(
        access_token: ENV.fetch("OPENAI_API_KEY"),
        request_timeout: REQUEST_TIMEOUT_SECONDS
      )
      response = client.moderations(parameters: { model: MODEL, input: @text })
      response.dig("results", 0, "category_scores") || {}
    end

    # 対象カテゴリのうち閾値を超えた中で最もスコアが高いものを返す
    def worst_blocked(scores)
      BLOCKED_CATEGORIES
        .map { |category| [ category, scores[category].to_f ] }
        .select { |_, score| score > THRESHOLD }
        .max_by { |_, score| score } || [ nil, nil ]
    end
  end
end
