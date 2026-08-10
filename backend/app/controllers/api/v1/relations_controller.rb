module Api
  module V1
    # 関連カード。カードとカードのつながりを足したり外したりする。
    #
    # 向きは持たない扱いにしている（Relation の説明を参照）。
    # 追加も削除も「相手のカード」を指定するだけで済むようにする。
    class RelationsController < BaseController
      include ItemSerialization

      before_action :set_item

      def index
        render json: { relations: serialize_relations }
      end

      def create
        other = current_user.items.find(params[:to_item_id])
        return render json: { error: "同じカードは関連づけられません" }, status: :unprocessable_entity if other.id == @item.id

        relation = Relation.find_or_initialize_by(
          user: current_user, from_item: @item, to_item: other, relation_type: Relation::RELATED
        )
        # 反対向きが既にあれば、それで足りている（2本持たない）
        return render json: { relations: serialize_relations }, status: :ok if reverse_exists?(other)

        relation.save!
        render json: { relations: serialize_relations }, status: :created
      rescue ActiveRecord::RecordNotUnique
        # 同時に2回押された場合。既にあるので、あるものを返す
        render json: { relations: serialize_relations }, status: :ok
      end

      def destroy
        Relation.for_user(current_user)
                .touching(@item.id)
                .where(from_item_id: params[:id]).or(
                  Relation.for_user(current_user).touching(@item.id).where(to_item_id: params[:id])
                )
                .destroy_all

        render json: { relations: serialize_relations }, status: :ok
      end

      private

      def set_item
        @item = current_user.items.find(params[:item_id])
      end

      def reverse_exists?(other)
        Relation.exists?(user: current_user, from_item: other, to_item: @item, relation_type: Relation::RELATED)
      end

      # 相手のカードを、一覧のカードと同じ形で返す（ミニカードとして描けるように）
      def serialize_relations
        relations = Relation.for_user(current_user)
                            .touching(@item.id)
                            .includes(
                              from_item: [ :item_type, { medias: { file_attachment: :blob } } ],
                              to_item: [ :item_type, { medias: { file_attachment: :blob } } ]
                            )
                            .order(created_at: :asc)

        relations.map { |relation| serialize_item(relation.other_side(@item.id)) }
      end
    end
  end
end
