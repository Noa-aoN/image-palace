module Api
  module V1
    module Admin
      # 作りかけの機能を、どこまで見せるかの設定。
      class FeatureFlagsController < BaseController
        def index
          render json: {
            features: FeatureFlag.overview,
            stages: FeatureFlag::STAGES.map { |stage| { value: stage, label: FeatureFlag::STAGE_LABELS[stage] } }
          }
        end

        # キーごとに作成/更新する（画面で触ったときに初めて行ができる）
        def upsert
          flag = FeatureFlag.find_or_initialize_by(key: params[:key])
          before = flag.stage
          flag.assign_attributes(flag_params)

          if flag.save
            audit!("feature_flag_update", details: { key: flag.key, before: before, after: flag.stage })
            render json: { feature: FeatureFlag.overview.find { |row| row[:key] == flag.key } }
          else
            render json: { errors: flag.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # 既定へ戻す（行を消せばモデルの DEFAULTS で動く）
        def destroy
          FeatureFlag.find_by!(key: params[:key]).destroy!
          audit!("feature_flag_reset", details: { key: params[:key] })

          render json: { feature: FeatureFlag.overview.find { |row| row[:key] == params[:key] } }
        end

        private

        def flag_params
          params.require(:feature).permit(:stage, :notes)
        end
      end
    end
  end
end
