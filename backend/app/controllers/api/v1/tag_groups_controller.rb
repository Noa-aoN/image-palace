module Api
  module V1
    class TagGroupsController < BaseController
      before_action :set_tag_group, only: [ :update, :destroy, :add_item, :remove_item, :reorder_items ]

      def index
        groups = current_user.tag_groups.ordered.includes(:tag_group_items)
        render json: { tag_groups: groups.map { |g| serialize_group(g) } }
      end

      def create
        group = current_user.tag_groups.build(create_params)
        group.position = next_position
        group.save!
        render json: serialize_group(group), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @tag_group.update!(update_params)
        render json: serialize_group(@tag_group)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # delete_tags=true の場合はグループ内のタグ実体ごと削除する（多重所属タグは他グループからも消える）。
      # false（既定）はグループのみ削除し、タグは残す（未所属または他グループに残る）。
      def destroy
        if ActiveModel::Type::Boolean.new.cast(params[:delete_tags])
          # has_many :through の destroy_all は中間テーブルしか消さないため、タグ実体を明示的に削除する。
          member_tags = @tag_group.tags.to_a
          @tag_group.destroy!
          member_tags.each(&:destroy!)
        else
          @tag_group.destroy!
        end
        head :no_content
      end

      # グループ全体の並び替え。{ ids: [group_id, ...] } を position 1.. に振り直す。
      def reorder
        ids = Array(params[:ids]).map(&:to_s)
        groups = current_user.tag_groups.where(id: ids).index_by(&:id)
        TagGroup.transaction do
          ids.each_with_index do |id, index|
            groups[id]&.update!(position: index + 1)
          end
        end
        head :no_content
      end

      # グループにタグを追加する。{ tag_id }。多重所属可。
      def add_item
        tag = current_user.tags.find(params[:tag_id])
        item = @tag_group.tag_group_items.where(tag_id: tag.id).first_or_initialize
        item.position ||= next_item_position(@tag_group)
        item.save!
        render json: serialize_group(@tag_group.reload), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # グループからタグを外す。
      def remove_item
        item = @tag_group.tag_group_items.find_by(tag_id: params[:tag_id])
        item&.destroy!
        render json: serialize_group(@tag_group.reload)
      end

      # グループ内タグの並び替え。{ tag_ids: [tag_id, ...] }。
      def reorder_items
        tag_ids = Array(params[:tag_ids]).map(&:to_s)
        items = @tag_group.tag_group_items.index_by(&:tag_id)
        TagGroupItem.transaction do
          tag_ids.each_with_index do |tag_id, index|
            items[tag_id]&.update!(position: index + 1)
          end
        end
        render json: serialize_group(@tag_group.reload)
      end

      private

      def set_tag_group
        @tag_group = current_user.tag_groups.find(params[:id])
      end

      def create_params
        params.require(:tag_group).permit(:name)
      end

      def update_params
        params.require(:tag_group).permit(:name, :pinned)
      end

      def next_position
        (current_user.tag_groups.maximum(:position) || 0) + 1
      end

      def next_item_position(group)
        (group.tag_group_items.maximum(:position) || 0) + 1
      end

      def serialize_group(group)
        {
          id: group.id,
          name: group.name,
          pinned: group.pinned,
          is_default: group.is_default,
          default_key: group.default_key,
          position: group.position,
          # position 順（NULLS LAST）でタグ ID を返す。フロントはこの順で描画する。
          tag_ids: group.tag_group_items.sort_by { |i| [ i.position || Float::INFINITY, i.created_at ] }.map(&:tag_id)
        }
      end
    end
  end
end
