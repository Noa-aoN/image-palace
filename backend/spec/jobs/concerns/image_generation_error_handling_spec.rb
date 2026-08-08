require "rails_helper"

RSpec.describe ImageGenerationErrorHandling do
  let(:handler) do
    Class.new do
      include ImageGenerationErrorHandling
    end.new
  end

  def non_retryable?(error) = handler.send(:non_retryable?, error)
  def message_for(error) = handler.send(:user_facing_error_message, error)

  # 本番で実際に返ってきた形（code と type が別値）
  def credit_exhausted_error
    Faraday::TooManyRequestsError.new(
      "429",
      {
        status: 429,
        body: {
          "error" => {
            "message" => "You have no credits remaining.",
            "type" => "insufficient_quota",
            "code" => "credit_balance_exhausted"
          }
        }
      }
    )
  end

  describe "#non_retryable?" do
    it "provider 非依存 taxonomy の NonRetryableError は true" do
      expect(non_retryable?(ImageGenerators::NonRetryableError.new)).to be(true)
      expect(non_retryable?(ImageGenerators::ContentPolicyError.new)).to be(true)
      expect(non_retryable?(ImageGenerators::QuotaError.new)).to be(true)
    end

    it "RetryableError は false" do
      expect(non_retryable?(ImageGenerators::RetryableError.new)).to be(false)
    end

    it "生の Faraday::BadRequestError（後方互換）は true" do
      expect(non_retryable?(Faraday::BadRequestError.new("400"))).to be(true)
    end

    it "請求上限コードを含む Faraday エラーは true" do
      error = Faraday::BadRequestError.new(
        "400", { status: 400, body: { "error" => { "code" => "billing_hard_limit_reached" } } }
      )
      expect(non_retryable?(error)).to be(true)
    end

    it "ネットワークエラーは false（リトライ対象）" do
      expect(non_retryable?(Faraday::TimeoutError.new("timeout"))).to be(false)
    end

    # 残高切れは 429 で返り、code は type と別値になる（2026-08-08 に本番で発生）。
    # code だけを見ていた頃はここが false になり、空振りのリトライを3回繰り返していた
    it "残高切れ（429 / code と type が別値）は true" do
      expect(non_retryable?(credit_exhausted_error)).to be(true)
    end

    it "type だけが insufficient_quota でも true" do
      error = Faraday::TooManyRequestsError.new(
        "429", { status: 429, body: { "error" => { "type" => "insufficient_quota" } } }
      )
      expect(non_retryable?(error)).to be(true)
    end

    it "クォータ以外の 429（純粋なレート制限）は false（リトライ対象）" do
      error = Faraday::TooManyRequestsError.new(
        "429", { status: 429, body: { "error" => { "code" => "rate_limit_exceeded", "type" => "requests" } } }
      )
      expect(non_retryable?(error)).to be(false)
    end
  end

  describe "#user_facing_error_message" do
    it "taxonomy エラーは自身の user_message を返す" do
      expect(message_for(ImageGenerators::ContentPolicyError.new)).to include("コンテンツポリシー")
      expect(message_for(ImageGenerators::QuotaError.new)).to include("一時的に利用できません")
      expect(message_for(ImageGenerators::RetryableError.new)).to include("通信が不安定")
    end

    it "生の Faraday 400 は曖昧入力メッセージ" do
      expect(message_for(Faraday::BadRequestError.new("400"))).to include("入力が曖昧")
    end

    it "コンテンツポリシー違反の 400 は専用メッセージ" do
      error = Faraday::BadRequestError.new("400 rejected by the safety system (moderation_blocked)")
      expect(message_for(error)).to include("コンテンツポリシー")
    end

    it "ネットワークエラーは再試行を促すメッセージ" do
      expect(message_for(Faraday::SSLError.new("eof"))).to include("通信が不安定")
    end

    it "残高切れは汎用の再試行メッセージではなくクォータ用の案内" do
      message = message_for(credit_exhausted_error)

      expect(message).to include("一時的に利用できません")
      expect(message).not_to include("時間を置いて再試行")
    end
  end

  describe "#notify_quota_exhausted" do
    # テスト環境の cache_store は :null_store で間引きが検証できないため実体のあるストアに差し替える
    before { allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new) }

    it "運営者向けに Sentry へ通知する" do
      expect(Sentry).to receive(:capture_message).with(/クォータ枯渇/, level: :error)

      handler.send(:notify_quota_exhausted, credit_exhausted_error)
    end

    # 一括作成で枯渇すると件数ぶん飛ぶため
    it "1時間に1回へ間引く" do
      expect(Sentry).to receive(:capture_message).once

      3.times { handler.send(:notify_quota_exhausted, credit_exhausted_error) }
    end
  end
end
