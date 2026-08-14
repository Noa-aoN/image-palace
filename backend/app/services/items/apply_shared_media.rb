# frozen_string_literal: true

module Items
  # 既にある絵を、そのカードへ付け替える。
  #
  # **作らない。** 生成を呼ばないので、クレジットは減らないし待ち時間も無い。
  # 生成のときと同じ道を通す（覆いの付け直し・サムネの引き継ぎ・記録）ので、
  # 「作った直後」と「戻したあと」で見え方が変わらない。
  class ApplySharedMedia
    def self.call(...) = new(...).call

    def initialize(item:, shared_media:)
      @item = item
      @shared_media = shared_media
    end

    def call
      media = @item.primary_media || @item.medias.build
      media.assign_attributes(
        media_type: "image",
        metadata: @shared_media.metadata,
        position: 0,
        # 戻したときも覆いは付け直す。一度承認した枠に、別の絵が覆い無しで入らないように
        needs_approval: safeguard?
      )
      media.save!

      @item.medias.where.not(id: media.id).destroy_all
      media.file.attach(@shared_media.file.blob)
      media.thumb.attach(@shared_media.thumb.blob) if @shared_media.thumb.attached?

      ItemMediaGeneration.record!(
        item: @item, shared_media: @shared_media,
        prompt: @shared_media.normalized_prompt, model: @shared_media.metadata["model"]
      )
      media
    end

    private

    def safeguard? = @item.user.setting&.image_safeguard.present?
  end
end
