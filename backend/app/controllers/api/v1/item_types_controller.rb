module Api
  module V1
    class ItemTypesController < BaseController
      # カードプロパティ編集用の種別一覧。認証済みユーザーが選択肢として利用する
      def index
        item_types = ItemType.order(:created_at)
        render json: {
          item_types: item_types.map { |it| { id: it.id, name: it.name, label: it.label } }
        }
      end
    end
  end
end
