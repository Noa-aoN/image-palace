module Api
  module V1
    class SpacesController < BaseController
      include ListPagination
      include ItemSerialization
      include CoverImageUpload

      before_action :set_space, only: [
        :show, :update, :destroy, :add_box, :remove_box, :upload_cover, :remove_cover
      ]

      def index
        # cover_point/cover_points は space_points を Ruby 側で走査するため、画像添付ごと preload して N+1 を防ぐ
        spaces = current_user.spaces.recent
                             .includes(space_points: { image_attachment: :blob })
                             .with_attached_cover_image
                             .with_attached_cover_thumb
        spaces, next_cursor = paginate_list(spaces)

        render json: { spaces: spaces.map { |s| serialize_space(s) }, next_cursor: next_cursor }
      end

      def show
        render json: serialize_space_detail(@space)
      end

      def create
        space = current_user.spaces.build(space_params)
        space.save!
        render json: serialize_space(space), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @space.assign_attributes(space_update_params)
        validate_cover!
        @space.save!
        render json: serialize_space(@space)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @space.destroy!
        head :no_content
      end

      # room 種別: コレクションを並べる
      def add_box
        box = current_user.boxes.find(params[:box_id])
        @space.space_boxes.find_or_create_by!(box: box)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def remove_box
        @space.space_boxes.find_by(box_id: params[:box_id])&.destroy!
        head :no_content
      end

      # POST /api/v1/spaces/:id/cover_image （multipart: cover_image）
      def upload_cover
        file = params[:cover_image]
        return render(json: { errors: [ "画像が指定されていません" ] }, status: :unprocessable_entity) if file.blank?

        attach_optimized_cover!(@space, file)
        @space.update!(cover_type: "custom")
        render json: serialize_space(@space)
      rescue CoverImageUpload::InvalidCover => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/spaces/:id/cover_image
      def remove_cover
        @space.cover_image.purge if @space.cover_image.attached?
        @space.cover_thumb.purge if @space.cover_thumb.attached?
        @space.update!(cover_type: "first_card")
        render json: serialize_space(@space)
      end

      private

      def set_space
        # serialize_space→cover_point/cover_points が space_points の画像添付を走査するため preload する
        @space = current_user.spaces.includes(space_points: { image_attachment: :blob }).find(params[:id])
      end

      def space_params
        params.require(:space).permit(:name, :description, :space_type)
      end

      def space_update_params
        params.require(:space).permit(
          :name, :description, :cover_space_point_id, :cover_type,
          :width, :depth, :height, :point_scale, :room_style,
          # 上書きはキーを明示して許可する（値の妥当性は Space 側で検証する）
          style_overrides: Space::STYLE_OVERRIDE_KEYS.map(&:to_sym)
        )
      end

      # 表紙はこのスペースのポイントのみ指定可能
      def validate_cover!
        return if @space.cover_space_point_id.blank?
        return if @space.space_points.exists?(id: @space.cover_space_point_id)

        @space.errors.add(:cover_space_point_id, "はこのスペースのポイントを指定してください")
        raise ActiveRecord::RecordInvalid, @space
      end

      def serialize_space(space)
        cover_point = space.cover_point
        {
          id: space.id,
          name: space.name,
          description: space.description,
          space_type: space.space_type,
          width: space.width,
          depth: space.depth,
          height: space.height,
          point_scale: space.point_scale,
          room_style: space.room_style,
          style_overrides: space.style_overrides,
          cover_type: space.cover_type,
          cover_space_point_id: space.cover_space_point_id,
          cover: cover_point ? serialize_point_image(cover_point) : nil,
          # ポイントの生成画像（順序付き、最大 COVER_CARDS_LIMIT 枚）
          cover_images: space.cover_points.map { |p| serialize_point_image(p) }.compact,
          cover_image: serialize_attached_cover(space),
          created_at: space.created_at
        }
      end

      # road / room とも loci ポイント（序数＋ポイント名＋画像、割当カード）を返す。
      # ※ room のコレクション棚（space_boxes）はデータ・API は温存しつつ、
      #   詳細表示はポイントベースに統一する（設計: docs/decisions/space-mapping-design.md）。
      def serialize_space_detail(space)
        points = space.space_points.ordered.includes(
          { item: [ :item_type, { medias: { file_attachment: :blob } } ] },
          { image_attachment: :blob }
        )
        serialize_space(space).merge(points: points.map { |p| serialize_point(p) })
      end
    end
  end
end
