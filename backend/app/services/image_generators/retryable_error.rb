module ImageGenerators
  # リトライで回復し得るエラー（一時的なネットワーク・レート制限・5xx 等）。
  # ジョブは再送出し、ActiveJob の retry_on バックオフに委ねる。
  class RetryableError < Error
    def user_message
      "通信が不安定だったため画像を生成できませんでした。時間を置いて再試行してください。"
    end
  end
end
