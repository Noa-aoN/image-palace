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
          :auto_generate_meanings, :auto_generate_tags, :default_image_style, :default_aspect_ratio,
          :display_style, :shelf_orientation, :onboarded,
          :regenerate_with_meaning,
          :diagram_mode, :motion_mode, :word_difficulty,
          library_order: []
        )
      end

      def serialize_setting(setting)
        {
          auto_generate_meanings: setting.auto_generate_meanings,
          auto_generate_tags: setting.auto_generate_tags,
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
          diagram_mode: setting.diagram_mode,
          motion_mode: setting.motion_mode,
          locale: setting.locale,
          timezone: setting.timezone
        }
      end
    end
  end
end
