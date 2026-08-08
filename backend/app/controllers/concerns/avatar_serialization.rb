# プロフィール（アバター含む）の JSON 整形。ProfilesController / AvatarsController で共通利用。
# URL は ItemSerialization の media_url / blob_available? を再利用する（CDN 直配信・local プロキシ対応）。
module AvatarSerialization
  extend ActiveSupport::Concern
  include ItemSerialization

  def profile_json(user)
    {
      name: user.name,
      email: user.email,
      role: user.role,
      # 「入居日」。アカウントを開いた日を画面に出す
      created_at: user.created_at,
      avatar_url: avatar_url(user),
      avatar_thumb_url: avatar_thumb_url(user),
      avatar_generation_status: user.avatar_generation_status,
      avatar_generation_error: user.avatar_generation_error
    }
  end

  def avatar_url(user)
    return nil unless user.avatar.attached? && blob_available?(user.avatar.blob)

    media_url(user.avatar.blob)
  end

  # 事前生成サムネがあれば優先、無ければ本体 URL にフォールバック。
  def avatar_thumb_url(user)
    if user.avatar_thumb.attached? && blob_available?(user.avatar_thumb.blob)
      media_url(user.avatar_thumb.blob)
    elsif user.avatar.attached? && blob_available?(user.avatar.blob)
      media_url(user.avatar.blob)
    end
  end
end
