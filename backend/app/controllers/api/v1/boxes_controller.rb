module Api
  module V1
    class BoxesController < BaseController
      include ListPagination
      include ItemSerialization
      include CoverImageUpload

      before_action :set_box, only: [
        :show, :update, :destroy, :add_entry, :remove_entry, :upload_cover, :remove_cover
      ]

      def index
        boxes = current_user.boxes
                                  .recent
                                  .left_joins(:box_entries)
                                  .select("boxes.*, COUNT(box_entries.id) AS entry_count")
                                  .group("boxes.id")
                                  # cover/cover_cards は先頭数件しか使わない。
                                  # box_entries を全件 preload すると中身の数に比例して重くなるため、
                                  # 必要数の取得はモデル側（cover_item_candidates）に任せる。
                                  .includes(:cover_item)
                                  .with_attached_cover_image
                                  .with_attached_cover_thumb

        boxes, next_cursor = paginate_list(boxes)
        Box.preload_cover_entries(boxes)

        render json: { boxes: boxes.map { |c| serialize_box(c) }, next_cursor: next_cursor }
      end

      # 中身は際限なく増えるため、全件は返さない。
      # 新しい順に一定件数ずつ返し、続きは最後の 1 件を cursor に渡してもらう。
      # offset ではなく cursor にするのは、深い位置ほど offset が遅くなるため。
      DEFAULT_ENTRY_LIMIT = 50
      MAX_ENTRY_LIMIT = 100

      def show
        entries = @box.box_entries.includes(:entry).order(created_at: :desc, id: :desc)
        entries = entries.where("box_entries.created_at < ?", cursor_time) if cursor_time
        entries = entries.limit(entry_limit + 1)

        rows = entries.to_a
        has_more = rows.size > entry_limit
        rows = rows.first(entry_limit)

        render json: serialize_box(@box).merge(
          entries: rows.filter_map { |e| serialize_entry(e) },
          next_cursor: has_more ? rows.last&.created_at&.iso8601(6) : nil,
          entry_count: @box.box_entries.count
        )
      end

      def create
        box = current_user.boxes.build(box_params)
        box.save!
        render json: serialize_box(box), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @box.assign_attributes(box_update_params)
        validate_cover!
        @box.save!
        render json: serialize_box(@box)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @box.destroy!
        head :no_content
      end

      # POST /api/v1/boxes/:id/entries { entry_type, entry_id }
      # entry_type は Item / Space / View
      def add_entry
        entry = find_owned_entry(params[:entry_type], params[:entry_id])
        @box.box_entries.find_or_create_by!(entry_type: params[:entry_type], entry_id: entry.id)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/boxes/:id/entries/:entry_type/:entry_id
      def remove_entry
        @box.box_entries
                   .find_by(entry_type: params[:entry_type], entry_id: params[:entry_id])&.destroy!
        # 表紙にしていたカードを外した場合は表紙指定も解除する
        if params[:entry_type] == "Item" && @box.cover_item_id == params[:entry_id]
          @box.update!(cover_item_id: nil)
        end
        head :no_content
      end

      # POST /api/v1/boxes/:id/cover_image （multipart: cover_image）
      def upload_cover
        file = params[:cover_image]
        return render(json: { errors: [ "画像が指定されていません" ] }, status: :unprocessable_entity) if file.blank?

        attach_optimized_cover!(@box, file)
        @box.update!(cover_type: "custom")
        render json: serialize_box(@box)
      rescue CoverImageUpload::InvalidCover => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/boxes/:id/cover_image
      def remove_cover
        @box.cover_image.purge if @box.cover_image.attached?
        @box.cover_thumb.purge if @box.cover_thumb.attached?
        @box.update!(cover_type: "first_card")
        render json: serialize_box(@box)
      end

      private

      def entry_limit
        requested = params[:limit].to_i
        return DEFAULT_ENTRY_LIMIT if requested <= 0

        [ requested, MAX_ENTRY_LIMIT ].min
      end

      def cursor_time
        return nil if params[:cursor].blank?

        Time.iso8601(params[:cursor])
      rescue ArgumentError
        nil
      end

      def set_box
        @box = current_user.boxes.find(params[:id])
      end

      def box_params
        params.require(:box).permit(:name, :description)
      end

      def box_update_params
        params.require(:box).permit(:name, :description, :cover_item_id, :cover_type)
      end

      # 表紙はコレクション内の Item エントリのみ指定可能
      def validate_cover!
        return if @box.cover_item_id.blank?
        return if @box.box_entries.exists?(entry_type: "Item", entry_id: @box.cover_item_id)

        @box.errors.add(:cover_item_id, "はこのボックス内のカードを指定してください")
        raise ActiveRecord::RecordInvalid, @box
      end

      # entry_type に応じて current_user 所有のオブジェクトを引く（他人のものは 404）
      def find_owned_entry(entry_type, entry_id)
        scope =
          case entry_type
          when "Item" then current_user.items
          when "Space" then current_user.spaces
          when "View" then current_user.views
          else raise ActiveRecord::RecordNotFound
          end
        scope.find(entry_id)
      end

      def serialize_box(box)
        {
          id: box.id,
          name: box.name,
          description: box.description,
          entry_count: box_entry_count(box),
          cover_type: box.cover_type,
          cover_item_id: box.cover_item_id,
          cover: serialize_media(box.cover&.primary_media),
          cover_images: box.cover_cards.map { |item| serialize_media(item.primary_media) }.compact,
          cover_image: serialize_attached_cover(box),
          created_at: box.created_at
        }
      end

      def box_entry_count(box)
        if box.has_attribute?(:entry_count)
          box.entry_count
        else
          box.box_entries.size
        end
      end

      def serialize_entry(box_entry)
        obj = box_entry.entry
        return nil if obj.nil?

        base = { entry_type: box_entry.entry_type, id: obj.id }
        case box_entry.entry_type
        when "Item"
          base.merge(title: obj.title, media: serialize_media(obj.primary_media))
        when "Space"
          base.merge(name: obj.name, cover: obj.cover_point ? serialize_point_image(obj.cover_point) : nil)
        when "View"
          base.merge(name: obj.name, cover: serialize_media(obj.cover&.primary_media))
        end
      end
    end
  end
end
