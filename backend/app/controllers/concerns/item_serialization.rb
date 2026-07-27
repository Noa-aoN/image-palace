module ItemSerialization
  extend ActiveSupport::Concern

  # アイテムの JSON 表現。コレクション一覧・詳細でカードのサムネイルを返すために利用する。
  # ItemsController と同等のメディア URL 解決を行う（将来的に共通化したい）。
  def serialize_item(item)
    {
      id: item.id,
      title: item.title,
      generation_status: item.generation_status,
      media: serialize_media(item.primary_media)
    }
  end

  # スペースのポイント（序数＋ポイント名＋そのポイント画像）。割当カードも返す（暫定）。
  def serialize_point(point)
    {
      id: point.id,
      position: point.position,
      name: point.name,
      generation_status: point.generation_status,
      generation_error: point.generation_error,
      x: point.x,
      y: point.y,
      surface: point.surface,
      u: point.u,
      v: point.v,
      image: serialize_point_image(point),
      item: point.item ? serialize_item(point.item) : nil
    }
  end

  def serialize_point_image(point)
    return nil unless point.image.attached?
    return nil unless blob_available?(point.image.blob)

    blob = point.image.blob
    {
      url: media_url(blob),
      thumb_url: media_thumb_url(point, blob),
      blur: point.metadata&.dig("lqip")
    }
  end

  # has_one_attached の custom カバー画像（デッキ/コレクション/スペース/キャンバス共通）
  # record は cover_image / cover_thumb を持つ Box / Space / View。
  def serialize_attached_cover(record)
    attachment = record.cover_image
    return nil unless attachment.attached?
    return nil unless blob_available?(attachment.blob)

    {
      url: media_url(attachment.blob),
      thumb_url: cover_thumb_url(record, attachment.blob)
    }
  end

  # 事前生成済みの cover_thumb があれば CDN 直配信。無い古いカバーは元画像にフォールバック。
  def cover_thumb_url(record, fallback_blob)
    thumb = record.cover_thumb if record.respond_to?(:cover_thumb)
    if thumb&.attached? && blob_available?(thumb.blob)
      media_url(thumb.blob)
    else
      media_url(fallback_blob)
    end
  end

  def serialize_media(media)
    return nil unless media&.file&.attached?
    return nil unless blob_available?(media.file.blob)

    blob = media.file.blob

    {
      id: media.id,
      url: media_url(blob),
      thumb_url: media_thumb_url(media, blob),
      blur: media.metadata&.dig("lqip"),
      media_type: media.media_type
    }
  end

  # 事前生成済みサムネがあれば CDN 直配信（Rails プロキシを経由しない）。
  # 無ければ元画像にフォールバックし、読み取りリクエスト中の動的 variant 生成は避ける。
  def media_thumb_url(media, fallback_blob)
    if media.respond_to?(:thumb) && media.thumb.attached? && blob_available?(media.thumb.blob)
      media_url(media.thumb.blob)
    else
      media_url(fallback_blob)
    end
  end

  def media_url(blob)
    cdn_base = ENV["CDN_BASE_URL"]
    return rails_storage_proxy_url(blob) if blob.service_name == "local"
    return url_for(blob) if cdn_base.blank?

    "#{cdn_base}/#{blob.key}"
  end

  def blob_available?(blob)
    return false if blob.blank?

    service = blob.service
    return true unless service.respond_to?(:path_for)

    File.exist?(service.path_for(blob.key))
  end
end
