# 画像生成ジョブ共通のエラー分類・ユーザー向けメッセージ生成。
#
# GenerateImageJob / GeneratePointImageJob / GenerateAvatarJob で同一だった
# 分類ロジックをここに集約する。新しいプロバイダを足してもジョブは無改修。
#
# 判定は provider 非依存の taxonomy（ImageGenerators::Error 系）を最優先し、
# Faraday など生の provider 例外にも後方互換でフォールバックする。
# OpenAI/FLUX は Faraday 例外を投げるためフォールバック側で分類され、
# Faraday を使わない将来の provider（Bedrock 等）は taxonomy 側で分類される。
module ImageGenerationErrorHandling
  extend ActiveSupport::Concern

  NETWORK_ERRORS = [
    EOFError,
    Errno::ECONNRESET,
    Faraday::ConnectionFailed,
    Faraday::SSLError,
    Faraday::TimeoutError,
    Net::ReadTimeout,
    OpenSSL::SSL::SSLError
  ].freeze

  # コンテンツポリシー違反は 400 系で返り、本文に moderation_blocked /
  # content_policy_violation / safety system 等のマーカーを含む。
  CONTENT_POLICY_MARKERS = /moderation_blocked|content[_ ]?policy|safety system/i

  # 請求上限・クォータ枯渇。リトライしても回復せず運営者の対応が必要なエラーコード。
  # OpenAI は同じ事象を code と type の両方で表す（残高切れは
  # code=credit_balance_exhausted / type=insufficient_quota）ため、両方を突き合わせる。
  QUOTA_ERROR_CODES = %w[
    billing_hard_limit_reached billing_limit_reached billing_limit_user_error
    credit_balance_exhausted insufficient_quota
  ].freeze

  private

  # リトライしても回復しないエラー（即 failed にする）。
  # 400 はリクエスト自体が拒否されており、請求/クォータ枯渇はステータスに依らず回復しない。
  def non_retryable?(error)
    return true if error.is_a?(ImageGenerators::NonRetryableError)

    error.is_a?(Faraday::BadRequestError) || quota_error?(error)
  end

  def user_facing_error_message(error)
    return error.user_message if error.is_a?(ImageGenerators::Error)
    return quota_error_message if quota_error?(error)

    case error
    when Faraday::BadRequestError
      if content_policy_violation?(error)
        "入力がコンテンツポリシーに反するため画像を生成できませんでした。別の単語でお試しください。"
      else
        "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。"
      end
    when *NETWORK_ERRORS
      "通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。"
    else
      "画像生成に失敗しました。時間を置いて再試行してください。"
    end
  end

  def quota_error_message
    "現在、画像生成を一時的に利用できません。時間をおいて再度お試しいただくか、運営者にお問い合わせください。"
  end

  # code だけを見ると、OpenAI が type はそのままに新しい code を足したときに取りこぼす。
  # 実際 2026-08-08 に code=credit_balance_exhausted が現れ、残高切れが
  # リトライ対象へ落ちて空振り3回＋誤った案内文になった。
  def quota_error?(error)
    (openai_error_codes(error) & QUOTA_ERROR_CODES).any?
  end

  # 運営者が気づけるようにする。ユーザー側の再試行では復旧せず、
  # 残高の補充が要るため、ログだけに残すと発覚が遅れる。
  #
  # 記録は DB（provider_incidents）に置く。app と worker は別マシンで、
  # 既定の file_store な Rails.cache はマシンをまたげないため、
  # worker が検知した事象を管理画面から読めない。
  # 通知は新規の発生だけに絞る（一括作成で件数ぶん飛ばさない）。
  def notify_quota_exhausted(error)
    incident = ProviderIncident.record!(
      provider: "openai",
      kind: ProviderIncident::QUOTA_EXHAUSTED,
      code: openai_error_codes(error).join(","),
      message: error.message.to_s[0, 500]
    )
    return unless defined?(Sentry)
    return unless incident.occurrences == 1

    Sentry.capture_message(
      "[画像生成] OpenAI のクォータ枯渇で生成を停止しました code=#{incident.code}",
      level: :error
    )
  rescue StandardError => e
    # 記録の失敗で本来の失敗処理を壊さない
    Rails.logger.error "[ImageGeneration] クォータ枯渇の記録に失敗しました #{e.class}: #{e.message}"
  end

  # メッセージ本文・レスポンス本文のどちらかにポリシー違反マーカーがあれば true。
  def content_policy_violation?(error)
    body = openai_error_body(error)
    marker = "#{error.message} #{body&.dig('error', 'code')} #{body&.dig('error', 'message')}"
    CONTENT_POLICY_MARKERS.match?(marker)
  end

  # Faraday エラーのレスポンス本文（OpenAI の JSON）を Hash で返す。取得できなければ nil。
  def openai_error_body(error)
    return nil unless error.respond_to?(:response) && error.response.is_a?(Hash)

    body = error.response[:body]
    body = parse_json(body) if body.is_a?(String)
    body.is_a?(Hash) ? body : nil
  end

  def openai_error_code(error)
    openai_error_codes(error).first
  end

  # code と type の両方を返す（どちらに事象が出るかは OpenAI 側の都合で変わる）
  def openai_error_codes(error)
    body = openai_error_body(error)
    return [] unless body

    [ body.dig("error", "code"), body.dig("error", "type") ].compact.map(&:to_s)
  end

  def parse_json(str)
    JSON.parse(str)
  rescue JSON::ParserError
    nil
  end
end
