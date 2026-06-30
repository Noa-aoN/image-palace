module Api
  module V1
    class ViewsController < BaseController
      include ItemSerialization
      include CoverImageUpload

      before_action :set_view, only: [
        :show, :update, :destroy, :add_item, :update_item, :remove_item, :reorder, :place_on_point, :clear_point,
        :upload_cover, :remove_cover
      ]

      def index
        # serialize_view→cover/cover_cards が view_items/cover_item の画像を走査するため preload して N+1 を防ぐ
        views = current_user.views.recent.includes(
          view_items: { item: { medias: { file_attachment: :blob } } },
          cover_item: { medias: { file_attachment: :blob } }
        ).with_attached_cover_image.with_attached_cover_thumb
        render json: { views: views.map { |v| serialize_view(v) } }
      end

      def show
        render json: serialize_view_detail(@view)
      end

      def create
        view = current_user.views.build(view_params)
        view.save!
        render json: serialize_view(view), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @view.assign_attributes(view_update_params)
        validate_cover!
        @view.save!
        render json: serialize_view(@view)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @view.destroy!
        head :no_content
      end

      # フリーボードにカードを配置する
      def add_item
        item = current_user.items.find(params[:item_id])
        view_item = @view.view_items.find_or_initialize_by(item_id: item.id)
        if @view.deck?
          # deck はカードを末尾に追加（順序は position。座標は既定 0）。
          view_item.position ||= next_deck_position
        else
          view_item.assign_attributes(placement_params)
        end
        view_item.save!
        render json: serialize_placement(view_item.tap { |vi| vi.item = item }), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # 配置（座標・重なり順）を更新する
      def update_item
        view_item = @view.view_items.find_by!(item_id: params[:item_id])
        view_item.update!(placement_params)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # deck: カードの並び替え（ordered_item_ids の順に position を 1..N で振り直す）
      def reorder
        ids = Array(params[:ordered_item_ids])
        ViewItem.transaction do
          ids.each_with_index do |item_id, index|
            @view.view_items.where(item_id: item_id).update_all(position: index + 1, updated_at: Time.current)
          end
        end
        head :no_content
      end

      # カードを外す
      def remove_item
        @view.view_items.find_by(item_id: params[:item_id])&.destroy!
        head :no_content
      end

      # space_map: スペースのポイントにカードを配置する。
      # 1 ポイント 1 カード（差し替え可）。同じカードは複数ポイントに置ける（再利用可）。
      def place_on_point
        point = view_space_point!
        item = current_user.items.find(params[:item_id])

        placement = @view.view_items.find_or_initialize_by(space_point_id: point.id)
        placement.item = item
        placement.save!
        render json: serialize_point_placement(point, placement), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/views/:id/cover_image （multipart: cover_image）
      def upload_cover
        file = params[:cover_image]
        return render(json: { errors: [ "画像が指定されていません" ] }, status: :unprocessable_entity) if file.blank?

        attach_optimized_cover!(@view, file)
        @view.update!(cover_type: "custom")
        render json: serialize_view(@view)
      rescue CoverImageUpload::InvalidCover => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/views/:id/cover_image
      def remove_cover
        @view.cover_image.purge if @view.cover_image.attached?
        @view.cover_thumb.purge if @view.cover_thumb.attached?
        @view.update!(cover_type: "first_card")
        render json: serialize_view(@view)
      end

      # space_map: ポイントからカードを外す
      def clear_point
        @view.view_items.find_by(space_point_id: params[:space_point_id])&.destroy!
        head :no_content
      end

      private

      def set_view
        # 詳細でも serialize_view が cover_cards（view_items）を走査するため preload する
        @view = current_user.views.includes(
          view_items: { item: { medias: { file_attachment: :blob } } },
          cover_item: { medias: { file_attachment: :blob } }
        ).find(params[:id])
      end

      # 配置先ポイントがこのキャンバスのスペースに属することを保証する
      def view_space_point!
        raise ActiveRecord::RecordNotFound unless @view.space
        @view.space.space_points.find(params[:space_point_id])
      end

      def view_params
        params.require(:view).permit(:name, :view_type, :space_id)
      end

      def view_update_params
        params.require(:view).permit(:name, :cover_item_id, :cover_type)
      end

      # 表紙はキャンバスに配置したカードのみ指定可能
      def validate_cover!
        return if @view.cover_item_id.blank?
        return if @view.view_items.exists?(item_id: @view.cover_item_id)

        @view.errors.add(:cover_item_id, "はこのキャンバスに配置したカードを指定してください")
        raise ActiveRecord::RecordInvalid, @view
      end

      def placement_params
        params.permit(:x, :y, :z_index)
      end

      # deck の末尾 position（最大 + 1）
      def next_deck_position
        (@view.view_items.maximum(:position) || 0) + 1
      end

      def serialize_view(view)
        {
          id: view.id,
          name: view.name,
          view_type: view.view_type,
          space_id: view.space_id,
          cover_type: view.cover_type,
          cover_item_id: view.cover_item_id,
          cover: serialize_media(view.cover&.primary_media),
          cover_images: view.cover_cards.map { |item| serialize_media(item.primary_media) }.compact,
          cover_image: serialize_attached_cover(view),
          created_at: view.created_at
        }
      end

      def serialize_view_detail(view)
        return serialize_space_map_detail(view) if view.space_map?

        # deck は position 順、freeboard は重なり順
        order = view.deck? ? Arel.sql("position ASC NULLS LAST, created_at ASC") : Arel.sql("z_index, created_at")
        placements = view.view_items
                         .includes(item: [ :item_type, { medias: { file_attachment: :blob } } ])
                         .order(order)
        serialize_view(view).merge(items: placements.map { |vi| serialize_placement(vi) })
      end

      # space_map: スペースのポイント一覧（序数＋名前＋ポイント画像）と、各ポイントへの配置カードを返す
      def serialize_space_map_detail(view)
        base = serialize_view(view)
        space = view.space
        return base.merge(space: nil, points: []) unless space

        points = space.space_points.ordered.includes(image_attachment: :blob)
        placed = view.view_items
                     .where.not(space_point_id: nil)
                     .includes(item: [ :item_type, { medias: { file_attachment: :blob } } ])
                     .index_by(&:space_point_id)

        base.merge(
          space: { id: space.id, name: space.name, space_type: space.space_type },
          points: points.map { |point| serialize_point_placement(point, placed[point.id]) }
        )
      end

      # ポイントの loci 情報 + そのポイントに配置されたカード
      def serialize_point_placement(point, view_item)
        {
          space_point_id: point.id,
          position: point.position,
          name: point.name,
          generation_status: point.generation_status,
          image: serialize_point_image(point),
          placed_item: view_item&.item ? serialize_item(view_item.item) : nil
        }
      end

      def serialize_placement(view_item)
        {
          item_id: view_item.item_id,
          x: view_item.x,
          y: view_item.y,
          z_index: view_item.z_index,
          position: view_item.position,
          item: serialize_item(view_item.item)
        }
      end
    end
  end
end
