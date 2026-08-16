module Api
  module V1
    # ユーザー設定（意味の自動生成など）
    class SettingsController < BaseController
      def show
        render json: serialize_setting(current_setting)
      end

      def update
        attrs = settings_params.except(:onboarded)
        # 初回確認を済ませた合図。日時で持ち、再表示しないようにする
        attrs[:onboarded_at] = Time.current if ActiveModel::Type::Boolean.new.cast(params[:setting][:onboarded])
        current_setting.update!(attrs)
        render json: serialize_setting(current_setting)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

      def current_setting
        @current_setting ||= current_user.setting || current_user.create_setting!
      end

      def settings_params
        params.require(:setting).permit(
          :auto_generate_meanings, :auto_generate_tags, :auto_generate_properties, :auto_detect_item_type,
          :share_generated_images, :default_image_style, :default_aspect_ratio,
          :display_style, :shelf_orientation, :onboarded,
          :regenerate_with_meaning, :image_safeguard, :palace_name,
          :card_detail_columns,
          :diagram_mode, :motion_mode, :word_difficulty, :default_card_preset,
          library_order: [],
          # 一覧に出す項目（順序つき）。**ここが唯一の出どころ**
          card_list_layout: [ :key, :visible ],
          # カードが持つ項目のひな型。[{ name:, keys: [] }]
          card_property_presets: [ :name, { keys: [] } ]
        )
      end

      def serialize_setting(setting)
        {
          auto_generate_meanings: setting.auto_generate_meanings,
          auto_generate_tags: setting.auto_generate_tags,
          auto_detect_item_type: setting.auto_detect_item_type,
          auto_generate_properties: setting.auto_generate_properties,
          # 自分が作らせた絵を、ほかの人にも使わせてよいか
          share_generated_images: setting.share_generated_images,
          default_image_style: setting.default_image_style,
          default_aspect_ratio: setting.default_aspect_ratio,
          display_style: setting.display_style,
          shelf_orientation: setting.shelf_orientation,
          word_difficulty: setting.word_difficulty,
          # 実際に描く並び（未設定でも既定の順が入る）
          library_order: setting.ordered_library_sections,
          # 初回の表示スタイル確認を出すかどうかの判断に使う
          onboarded: setting.onboarded_at.present?,
          regenerate_with_meaning: setting.regenerate_with_meaning,
          image_safeguard: setting.image_safeguard,
          # 一覧で名前として出す項目。空なら見出し語
          # カード詳細で項目を何列に並べるかの既定。1枚ずつの指定はカード側が持つ
          card_detail_columns: setting.card_detail_columns,
          palace_name: setting.palace_name,
          card_property_presets: setting.card_property_presets,
          # 保存していない人には既定を返す（書き戻さない）
          card_list_layout: setting.card_list_layout_entries,
          max_card_list_layout: Setting::MAX_CARD_LIST_LAYOUT,
          card_list_builtin_keys: Setting::CARD_LIST_BUILTIN_KEYS,
          default_card_preset: setting.default_card_preset,
          diagram_mode: setting.diagram_mode,
          motion_mode: setting.motion_mode,
          locale: setting.locale,
          timezone: setting.timezone
        }
      end
    end
  end
end
