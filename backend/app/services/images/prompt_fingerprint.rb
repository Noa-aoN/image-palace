# frozen_string_literal: true

module Images
  # そのカードで「いま何を注文することになるか」を1つの値にまとめる。
  #
  # 作り直しの可否を決めるには、**入力が変わったか**を知る必要がある。
  # 画面から来る指示の有無では判定できない。作り直しパネルは指示欄が空でも
  # `custom_prompt: ""` を必ず送るので、「指示が渡された＝変えた」にはならない。
  # 単語や情景の書き換えは別の口（PATCH）から入るので、そもそも通らない。
  #
  # なので、実際に供給側へ渡る文字列そのものを突き合わせる。
  # ここが同じなら結果も同じ。違えば別の注文。
  #
  # 生成ジョブもこれを使う。同じ組み立てを2か所に書くと、片方だけ変わったときに
  # 「変えたのに変わっていない扱い」になり、直せない失敗が残る。
  module PromptFingerprint
    Result = Struct.new(:prompt, :model_key, :cache_key, :digest, keyword_init: true)

    module_function

    def call(item, include_meaning: false)
      prompt = PromptBuilderService.effective_prompt(item, include_meaning: include_meaning)
      # 用途や上限で既定に落ちることがあるので、実際に使う key で引く
      model_key = GenerateImageService.usable_key(item.image_model, purpose: "item")
      cache_key = GenerateImageService.namespaced_cache_key(
        NormalizePromptService.call(prompt), aspect_ratio: item.aspect_ratio, model_key: model_key
      )

      Result.new(prompt: prompt, model_key: model_key, cache_key: cache_key, digest: digest(cache_key))
    end

    # 全文は残さない。ユーザー入力（個人情報・機密語句を含み得る）なので、突き合わせに足るだけ持つ
    def digest(cache_key)
      Digest::SHA256.hexdigest(cache_key)[0, 16]
    end
  end
end
