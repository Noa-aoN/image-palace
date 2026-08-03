# frozen_string_literal: true

module Images
  # 説明文・情景プロンプトを、単語ごとに世界で1回だけ作る。
  #
  # 画像（shared_medias）と同じ考え方。文章生成は画像より遥かに安いが、
  # 同じ単語で同じ計算を人数分繰り返す理由は無い。
  #
  # キャッシュキーは「単語」だけにする。スタイルやカスタム指示は情景の後ろに
  # 足す形で効かせるため、ここに含めると同じ情景を無駄に作り直すことになる。
  class BriefResolver
    # 生成をまるごと止めるための逃げ道。誤動作時にデプロイ無しで従来の挙動へ戻せる
    def self.enabled?
      ENV.fetch("IMAGE_BRIEF_ENABLED", "true") != "false"
    end

    def self.call(title:)
      new(title).call
    end

    def initialize(title)
      @title = title.to_s.strip
    end

    # SharedBrief を返す。無効化されている・単語が空なら nil
    def call
      return nil unless self.class.enabled?
      return nil if @title.blank?

      cached = SharedBrief.for_source(source_key).first
      return cached if cached

      result = BriefService.call(title: @title)
      create_shared_brief!(result)
    end

    private

    def source_key
      "#{NormalizePromptService.call(@title)}\nv#{BriefService::PROMPT_VERSION}"
    end

    def create_shared_brief!(result)
      SharedBrief.create!(
        normalized_source: source_key,
        description: result.description,
        subject_kind: result.subject_kind,
        scene_prompt: result.scene_prompt,
        metadata: { "model" => result.model }
      )
    rescue ActiveRecord::RecordNotUnique
      # 同じ単語を同時に作ったときは、先に入った方を使う
      SharedBrief.for_source(source_key).first or raise
    end
  end
end
