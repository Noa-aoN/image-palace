module ImageGenerators
  # リトライしても回復しないエラー（不正な入力・拒否）。ジョブは即 failed にする。
  class NonRetryableError < Error
    def user_message
      "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。"
    end
  end
end
