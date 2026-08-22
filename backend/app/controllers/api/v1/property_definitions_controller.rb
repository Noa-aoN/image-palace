module Api
  module V1
    # カードが持つ項目の定義。種別ごとに、利用者が自分で決める。
    #
    # ここは「その種別のカード**全部**に効く」設定なので、
    # 1枚のカードの上ではなく、独立した入口（右パネル）から触る想定。
    # 値そのものはカードごとなので ItemPropertiesController が受ける。
    class PropertyDefinitionsController < BaseController
      def index
        scope = current_user.property_definitions
        scope = scope.for_item_type(params[:item_type_id]) if params[:item_type_id].present?
        render json: { property_definitions: scope.ordered.map { |d| serialize(d) } }
      end

      def create
        if limit_reached?(definition_params[:item_type_id])
          return render json: { error: "1つの種別に持てる項目は#{PropertyDefinition::MAX_PER_ITEM_TYPE}個までです" },
                        status: :unprocessable_entity
        end

        definition = current_user.property_definitions.create!(definition_params)
        render json: serialize(definition), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        # key と種別は変えさせない。変えると、既に入っている値がどの項目のものか辿れなくなる
        definition.update!(definition_params.slice(:label, :value_type, :description))
        render json: serialize(definition)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        definition.destroy!
        head :no_content
      end

      # 並び替え。渡された順に position を振り直す
      def reorder
        ids = Array(params[:ids]).map(&:to_s)
        targets = current_user.property_definitions.where(id: ids).index_by(&:id)
        return render(json: { error: "並び替える対象がありません" }, status: :unprocessable_entity) if targets.empty?

        PropertyDefinition.transaction do
          ids.each_with_index { |id, index| targets[id]&.update!(position: index) }
        end
        render json: { property_definitions: current_user.property_definitions.ordered.map { |d| serialize(d) } }
      end

      private

      def definition
        @definition ||= current_user.property_definitions.find(params[:id])
      end

      def limit_reached?(item_type_id)
        current_user.property_definitions.for_item_type(item_type_id).count >= PropertyDefinition::MAX_PER_ITEM_TYPE
      end

      def definition_params
        params.require(:property_definition)
              .permit(:item_type_id, :key, :label, :value_type, :description, :category, options: [])
              .to_h.symbolize_keys
      end

      def serialize(record)
        {
          id: record.id,
          item_type_id: record.item_type_id,
          key: record.key,
          label: record.label,
          value_type: record.value_type,
          # 何のために持つ項目か（その語のこと / 覚えかた / 整理）
          category: record.category,
          description: record.description,
          # 選ぶ項目の選択肢。ほかの型では空のまま
          options: record.options,
          position: record.position
        }
      end
    end
  end
end
