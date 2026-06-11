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

  def serialize_media(media)
    return nil unless media&.file&.attached?
    return nil unless blob_available?(media.file.blob)

    blob = media.file.blob

    {
      id: media.id,
      url: media_url(blob),
      thumb_url: thumbnail_url(blob),
      media_type: media.media_type
    }
  end

  def media_url(blob)
    cdn_base = ENV["CDN_BASE_URL"]
    return rails_storage_proxy_url(blob) if blob.service_name == "local"
    return url_for(blob) if cdn_base.blank?

    "#{cdn_base}/#{blob.key}"
  end

  def thumbnail_url(blob)
    return media_url(blob) unless blob.image?
    return media_url(blob) if blob.service_name == "local"

    variant = blob.variant(resize_to_limit: [ 480, 480 ]).processed
    url_for(variant)
  rescue LoadError, StandardError
    media_url(blob)
  end

  def blob_available?(blob)
    return false if blob.blank?

    service = blob.service
    return true unless service.respond_to?(:path_for)

    File.exist?(service.path_for(blob.key))
  end
end
