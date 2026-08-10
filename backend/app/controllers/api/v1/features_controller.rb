module Api
  module V1
    # 画面が「この機能をどこまで出すか」を知るための一覧。
    #
    # 段階の判断はサーバー側の1か所に集める。画面ごとにベタ書きしていると、
    # 出す・出さないを変えるたびにデプロイが要る。
    class FeaturesController < BaseController
      def index
        render json: { features: FeatureFlag.stages }
      end
    end
  end
end
