module Api
  module V1
    # 画面が「この機能をどこまで出すか」を知るための一覧。
    #
    # 段階の判断はサーバー側の1か所に集める。画面ごとにベタ書きしていると、
    # 出す・出さないを変えるたびにデプロイが要る。
    class FeaturesController < BaseController
      def index
        stages = FeatureFlag.stages
        render json: {
          features: stages,
          # なぜ準備中かの一言。書かれているものだけ返す
          notes: FeatureFlag.public_notes,
          # パス → キー。サイドバーとページ本体が、いま開いている場所から段階を引ける
          paths: FeatureFlag::DEFAULTS.filter_map { |key, d| [ d[:path], key ] if d[:path] }.to_h
        }
      end
    end
  end
end
