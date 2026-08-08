class GenerateImageJob < ApplicationJob
  include ImageGenerationErrorHandling

  queue_as :default

  # OpenAI レート制限・ネットワーク障害に対して指数バックオフでリトライ
  # 15s → 60s → 240s の間隔で最大3回リトライ（計4回実行）
  # 全リトライ消費後に failed にする
  retry_on StandardError, wait: :polynomially_longer, attempts: 3 do |job, error|
    item_id = job.arguments[0]
    job.send(:mark_failed!, item_id, error)
    Rails.logger.error "[GenerateImageJob] ALL RETRIES EXHAUSTED item_id=#{item_id} error=#{error.message}"
  end

  def perform(item_id, force_generate: false, use_meaning: false)
    item = Item.find_by(id: item_id)
    return unless item

    item.with_lock do
      item.reload
      current_media = item.primary_media
      if item.generation_status == "completed" &&
         current_media&.file&.attached? &&
         blob_available?(current_media.file.blob) &&
         !force_generate
        Rails.logger.info "[GenerateImageJob] SKIP item_id=#{item.id} status=completed"
        return
      end

      item.update_generation_status!("processing")
      # スタイル・カスタム指示を反映した有効プロンプト。キャッシュキーと生成の両方に使う。
      # use_meaning が true なら意味・説明文も補足として加える（再生成オプション）。
      effective_prompt = PromptBuilderService.effective_prompt(item, include_meaning: use_meaning)
      normalized = NormalizePromptService.call(effective_prompt)
      # provider/model が変わればキャッシュも分ける（既定 openai/gpt-image-1 は後方互換で素のキー）。
      cache_key = GenerateImageService.namespaced_cache_key(normalized, aspect_ratio: item.aspect_ratio)
      # プロンプト全文はユーザー入力（個人情報・機密語句を含み得る）なのでログに残さない。
      # 相関用にハッシュの先頭と長さだけ記録する。
      prompt_key = Digest::SHA256.hexdigest(cache_key)[0, 8]
      Rails.logger.info "[GenerateImageJob] START item_id=#{item.id} prompt_key=#{prompt_key} prompt_len=#{effective_prompt.length}"

      lock_shared_media_cache!(cache_key) unless force_generate
      cached = force_generate ? nil : cached_shared_media(cache_key)

      if cached
        Rails.logger.info "[GenerateImageJob] CACHE HIT prompt_key=#{prompt_key} shared_media_id=#{cached.id}"
        attach_from_shared_media(item, cached)
      else
        if !force_generate && SharedMedia.for_prompt(cache_key).exists?
          Rails.logger.warn "[GenerateImageJob] CACHE STALE prompt_key=#{prompt_key}"
        end
        Rails.logger.info "[GenerateImageJob] CACHE MISS prompt_key=#{prompt_key}"
        result = GenerateImageService.call(prompt: effective_prompt, aspect_ratio: item.aspect_ratio)
        shared_media = create_shared_media!(item, shared_media_key(cache_key, force_generate:), result)
        attach_image_data(
          shared_media, result.image_data, result.content_type,
          crop_ratio: AspectRatios.crop_ratio(item.aspect_ratio)
        )
        attach_from_shared_media(item, shared_media)
      end

      item.update_generation_status!("completed")
      notify_completed!(item)
      Rails.logger.info "[GenerateImageJob] COMPLETE item_id=#{item.id}"
    end
  rescue StandardError => e
    # 400（ポリシー違反・曖昧な入力）や請求上限・クォータ枯渇はリトライしても回復しないため、
    # retry_on に渡さず即 failed にする。回復し得るエラー（通信・レート制限等）のみ再送出する。
    raise unless non_retryable?(e)

    Rails.logger.warn "[GenerateImageJob] NON-RETRYABLE item_id=#{item_id} code=#{openai_error_code(e) || e.class} -> failed"
    notify_quota_exhausted(e) if quota_error?(e)
    mark_failed!(item_id, e)
  end

  private

  def cached_shared_media(normalized)
    SharedMedia.for_prompt(normalized).detect { |shared| blob_available?(shared.file.blob) }
  end

  def create_shared_media!(item, normalized, result)
    SharedMedia.create!(
      normalized_prompt: normalized,
      user_id: item.user_id,
      metadata: result.metadata
    )
  rescue ActiveRecord::RecordNotUnique
    shared_media = cached_shared_media(normalized)
    return shared_media if shared_media

    raise
  end

  def shared_media_key(normalized, force_generate:)
    return normalized unless force_generate

    "#{normalized}\nforce:#{SecureRandom.uuid}"
  end

  def lock_shared_media_cache!(normalized)
    key = Digest::SHA256.hexdigest(normalized)[0, 15].to_i(16)
    ActiveRecord::Base.connection.execute("SELECT pg_advisory_xact_lock(#{key})")
  end

  def attach_from_shared_media(item, shared_media)
    media = item.primary_media || item.medias.build
    media.assign_attributes(
      media_type: "image",
      metadata: shared_media.metadata,
      position: 0
    )
    media.save!

    item.medias.where.not(id: media.id).destroy_all
    media.file.attach(shared_media.file.blob)
    # 事前生成済みサムネがあれば参照（CDN 直配信用）。無い古いキャッシュは未添付のままで OK。
    media.thumb.attach(shared_media.thumb.blob) if shared_media.thumb.attached?
  end

  # crop_ratio: 生成 API が直接出せない比（黄金比など）へ切り出すときに渡す
  def attach_image_data(shared_media, image_data, content_type, crop_ratio: nil)
    require "stringio"

    # 保存前にリサイズ + WebP 変換でストレージ・配信コストを抑える。
    # あわせて一覧用サムネ(480px)と LQIP プレースホルダも生成する。
    optimized = OptimizeImageService.call(
      image_data: image_data,
      content_type: content_type,
      crop_ratio: crop_ratio
    )

    shared_media.file.attach(
      io: StringIO.new(optimized.data),
      filename: "#{SecureRandom.uuid}.#{optimized.extension}",
      content_type: optimized.content_type
    )

    if optimized.thumb_data
      shared_media.thumb.attach(
        io: StringIO.new(optimized.thumb_data),
        filename: "#{SecureRandom.uuid}.webp",
        content_type: "image/webp"
      )
    end

    # LQIP（data URL）はメタデータに保存し、serializer 経由でフロントのプレースホルダに使う。
    shared_media.update!(metadata: shared_media.metadata.merge("lqip" => optimized.lqip)) if optimized.lqip
  end

  def blob_available?(blob)
    return false if blob.blank?

    service = blob.service
    return true unless service.respond_to?(:path_for)

    File.exist?(service.path_for(blob.key))
  end

  def mark_failed!(item_id, error)
    item = Item.find_by(id: item_id)
    return unless item

    message = user_facing_error_message(error)
    item.mark_generation_failed!(
      message: message,
      code: error.class.name
    )
    notify_failed!(item, message)
  end

  # 生成の結果をお知らせに残す。ページを離れていても後から結果に気づけるようにする。
  # 通知の生成で本処理を壊さないよう、失敗してもログに残すだけにする。
  def notify_completed!(item)
    Notifications::CreateService.call(
      user: item.user,
      kind: "item_generation_completed",
      title: "「#{item.title}」の画像生成が完了しました",
      url: "/items/#{item.id}",
      payload: { "item_id" => item.id }
    )
  rescue StandardError => e
    Rails.logger.error "[GenerateImageJob] NOTIFY FAILED item_id=#{item.id} error=#{e.message}"
  end

  def notify_failed!(item, message)
    Notifications::CreateService.call(
      user: item.user,
      kind: "item_generation_failed",
      title: "「#{item.title}」の画像生成に失敗しました",
      body: message,
      url: "/items/#{item.id}",
      payload: { "item_id" => item.id }
    )
  rescue StandardError => e
    Rails.logger.error "[GenerateImageJob] NOTIFY FAILED item_id=#{item.id} error=#{e.message}"
  end
end
