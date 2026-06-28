module Api
  module V1
    # ユーザー設定（意味の自動生成など）
    class SettingsController < BaseController
      def show
        render json: serialize_setting(current_setting)
      end

      def update
        current_setting.update!(settings_params)
        render json: serialize_setting(current_setting)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

      def current_setting
        @current_setting ||= current_user.setting || current_user.create_setting!
      end

      def settings_params
        params.require(:setting).permit(:auto_generate_meanings, :auto_generate_tags, :default_image_style)
      end

      def serialize_setting(setting)
        {
          auto_generate_meanings: setting.auto_generate_meanings,
          auto_generate_tags: setting.auto_generate_tags,
          default_image_style: setting.default_image_style,
          locale: setting.locale,
          timezone: setting.timezone
        }
      end
    end
  end
end
