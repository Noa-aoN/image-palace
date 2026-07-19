module ImageGenerators
  # 請求上限・クォータ枯渇。運営者の対応が必要で、リトライでは回復しない。
  class QuotaError < NonRetryableError
    def user_message
      "現在、画像生成を一時的に利用できません。時間をおいて再度お試しいただくか、運営者にお問い合わせください。"
    end
  end
end
