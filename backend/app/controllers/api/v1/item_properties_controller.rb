module Api
  module V1
    # カード1枚ぶんの、項目の値。
    #
    # 値は「このカードだけ」に効くので、カードの画面で直接触れる。
    # どの項目を持つかの定義は PropertyDefinitionsController（＝種別ぜんぶに効く）。
    # 効く範囲で入口を分けてある。
    class ItemPropertiesController < BaseController
      before_action :set_item

      # 値を入れる・書き換える。空にしたら行ごと消す
      # （空の行を残すと「未設定」と区別が付かない）。
      def upsert
        definition = current_user.property_definitions.find(params[:property_definition_id])
        record = item.item_properties.find_or_initialize_by(property_definition: definition)
        record.typed_value = params[:value]

        if record.blank_value?
          record.destroy if record.persisted?
          return render json: { property_definition_id: definition.id, value: definition.list? ? [] : nil }
        end

        record.save!
        render json: serialize(record)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

      attr_reader :item

      def set_item
        @item = current_user.items.find(params[:item_id])
      end

      def serialize(record)
        {
          property_definition_id: record.property_definition_id,
          key: record.property_definition.key,
          label: record.property_definition.label,
          value_type: record.property_definition.value_type,
          value: record.typed_value
        }
      end
    end
  end
end
