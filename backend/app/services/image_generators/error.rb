module ImageGenerators
  # provider 非依存の画像生成エラー基底。
  # 各プロバイダ（OpenAI/FLUX/将来の Bedrock 等）は、自分の native 例外を
  # この体系にマップして投げてよい。ジョブ側は provider を知らずに
  # 「リトライすべきか」「ユーザーに何を見せるか」を判断できる。
  #
  # なお OpenAI/FLUX は Faraday 例外をそのまま投げ、ジョブ側の
  # ImageGenerationErrorHandling が Faraday 例外も後方互換で分類する。
  # この taxonomy は主に Faraday を使わない provider（AWS Bedrock 等）を
  # 追加するときの受け皿。
  class Error < StandardError
    # 失敗時にユーザーへ提示するメッセージ。サブクラスで上書きする。
    def user_message
      "画像生成に失敗しました。時間を置いて再試行してください。"
    end
  end
end
