module Api
  module V1
    # そのカードでこれまでに使った絵。
    #
    # **絵そのものは作らない。** 既にある shared_media を付け替えるだけなので、
    # 選び直してもクレジットは減らない。
    class MediaGenerationsController < BaseController
      include ItemSerialization

      before_action :set_item

      def index
        rows = @item.item_media_generations.recent.includes(shared_media: { file_attachment: :blob })

        render json: { generations: rows.filter_map { |row| serialize(row) } }
      end

      # 過去の絵に戻す。生成はしない
      def apply
        row = @item.item_media_generations.find(params[:id])
        shared = row.shared_media
        return render json: { error: "この絵はもう残っていません" }, status: :gone unless available?(shared)

        Items::ApplySharedMedia.call(item: @item, shared_media: shared)

        render json: { ok: true }
      end

      # 記録だけ消す。**絵は消さない**（同じ絵をほかの人が使っている）
      def destroy
        row = @item.item_media_generations.find(params[:id])
        row.destroy!

        head :no_content
      end

      private

      def set_item
        @item = current_user.items.find(params[:item_id])
      end

      # 実体の無い古いキャッシュは出さない（枠だけが並ぶことになる）
      def available?(shared_media)
        shared_media.file.attached? && blob_available?(shared_media.file.blob)
      end

      def serialize(row)
        shared = row.shared_media
        return nil unless available?(shared)

        {
          id: row.id,
          used_at: row.used_at,
          model: row.model || shared.metadata["model"],
          quality: shared.metadata["quality"],
          prompt: row.prompt,
          url: media_url_for(shared),
          # いま使っているものかどうか（一覧で印を付ける）。
          # **同じ実体を付けている**かで見る。メタ情報は同じ内容が並ぶので当てにならない
          current: current_blob_id.present? && current_blob_id == shared.file.blob&.id
        }
      end

      # いま付いている絵の実体。1回だけ引く
      def current_blob_id
        return @current_blob_id if defined?(@current_blob_id)

        media = @item.primary_media
        @current_blob_id = media&.file&.attached? ? media.file.blob&.id : nil
      end

      def media_url_for(shared)
        blob = shared.thumb.attached? ? shared.thumb.blob : shared.file.blob
        media_url(blob)
      rescue StandardError
        nil
      end
    end
  end
end
