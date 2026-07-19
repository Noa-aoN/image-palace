module ImageGenerators
  # コンテンツポリシー違反。NonRetryable の一種だがユーザー向け文言を分ける。
  class ContentPolicyError < NonRetryableError
    def user_message
      "入力がコンテンツポリシーに反するため画像を生成できませんでした。別の単語でお試しください。"
    end
  end
end
