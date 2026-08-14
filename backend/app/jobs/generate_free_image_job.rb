require "stringio"

# 自由な指示から、カードの項目に置く絵を作る。
#
# **同じ指示は世界で1回しか作らない**（shared_medias のキャッシュを使う）。
# カードの絵と同じ考え方で、指示が同じなら結果も同じでよい。
# キャッシュに当たったぶんは API を呼ばないが、クレジットは同じだけ減っている
# （呼び出し側で先に引いてある）ので、使った記録は残す。
class GenerateFreeImageJob < ApplicationJob
  include ImageGenerationErrorHandling

  queue_as :default

  retry_on StandardError, wait: :polynomially_longer, attempts: 3 do |job, error|
    job.send(:mark_failed!, job.arguments[0], error)
  end

  def perform(item_property_id, prompt)
    property = ItemProperty.find_by(id: item_property_id)
    return unless property

    prompt = prompt.to_s.strip
    return if prompt.blank?

    write_status!(property, "processing")

    shared_media = cached(prompt) || generate!(property, prompt)
    write!(property, shared_media: shared_media, status: "completed")
  rescue StandardError => e
    raise unless non_retryable?(e)

    mark_failed!(item_property_id, e)
  end

  private

  # 取る側は、共有の置き場をそのまま見る（ほかの人が作った絵は使う）
  def cached(prompt)
    SharedMedia.for_prompt(cache_key(prompt)).detect { |shared| shared.file.attached? }
  end

  # カードの絵と鍵の付け方を分ける。**同じ文でも用途が違えば別の絵**でよいし、
  # 混ざると片方を消したときにもう片方が壊れる
  def cache_key(prompt) = "free_image:#{prompt}"

  # 置く側の鍵。「ほかの人に使わせない」と決めている人のぶんは、その人だけの鍵で置く
  def write_key(prompt, user)
    return cache_key(prompt) if user&.setting.nil? || user.setting.share_generated_images

    "#{cache_key(prompt)}\nprivate:#{user.id}"
  end

  def generate!(property, prompt)
    user = property.item.user
    result = GenerateImageService.call(prompt: prompt, kind: "free_image", user_id: user.id)
    shared = SharedMedia.create!(
      normalized_prompt: write_key(prompt, user), user_id: user.id, metadata: result.metadata
    )
    attach!(shared, result)
    shared
  rescue ActiveRecord::RecordNotUnique
    # ぶつかった相手は、いま置こうとした鍵の行。共有の鍵を見に行っても見つからない
    SharedMedia.for_prompt(write_key(prompt, user)).detect { |s| s.file.attached? } || raise
  end

  def attach!(shared, result)
    optimized = OptimizeImageService.call(image_data: result.image_data, content_type: result.content_type)
    shared.file.attach(
      io: StringIO.new(optimized.data),
      filename: "#{SecureRandom.uuid}.#{optimized.extension}",
      content_type: optimized.content_type
    )
    return unless optimized.thumb_data

    shared.thumb.attach(
      io: StringIO.new(optimized.thumb_data), filename: "#{SecureRandom.uuid}.webp", content_type: "image/webp"
    )
  end

  def write_status!(property, status)
    write!(property, status: status)
  end

  # 小見出しと指示は消さない。**作り直しても、書いたものはそのまま残す**
  def write!(property, status:, shared_media: nil)
    current = property.typed_value || {}
    property.typed_value = current.merge(
      "status" => status,
      "shared_media_id" => shared_media&.id || current["shared_media_id"]
    ).compact
    property.save!
  end

  def mark_failed!(item_property_id, error)
    property = item_property_id.is_a?(ItemProperty) ? item_property_id : ItemProperty.find_by(id: item_property_id)
    return unless property

    current = property.typed_value || {}
    property.typed_value = current.merge("status" => "failed", "error" => error.message.to_s.first(200))
    property.save!
  end
end
