module ItemSerialization
  extend ActiveSupport::Concern

  # 一覧で毎回書くには長いので、コントローラからも短い名前で引けるようにする
  MEDIA_INCLUDES = Item::MEDIA_INCLUDES

  # アイテムの JSON 表現。コレクション一覧・詳細でカードのサムネイルを返すために利用する。
  # ItemsController と同等のメディア URL 解決を行う（将来的に共通化したい）。
  def serialize_item(item)
    {
      id: item.id,
      aspect_ratio: item.aspect_ratio,
      title: item.title,
      generation_status: item.generation_status,
      from_preview: preview_item?(item),
      media: serialize_media(item.primary_media)
    }
  end

  # 下見で入ったカードの id。**1リクエストに1回だけ引く。**
  #
  # 下見は自分の口座に入るので、見た目が本物と変わらない。
  # 印が無いと、自分で作ったカードと混ざる。
  #
  # 引くのは下見に入れる人だけ。**ふつうの利用者には1本も増やさない**
  def preview_item_ids
    @preview_item_ids ||= ::Studio::Preview.item_ids_for(try(:current_user))
  end

  def preview_item?(item)
    preview_item_ids.include?(item.id)
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
      scale: point.scale,
      rotation_x: point.rotation_x,
      rotation_y: point.rotation_y,
      rotation_z: point.rotation_z,
      image: serialize_point_image(point),
      # 画像を作るのに使った指示。思った絵にならないときに確かめられるようにする。
      # ポイントは名前をそのまま渡すので、名前が指示そのもの。
      prompt: point.name,
      revised_prompt: point.revised_prompt,
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
      media_type: media.media_type,
      # セーフガードを入にしてから作った絵は、承認するまで覆いを掛けて出す
      needs_approval: media.needs_approval
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
