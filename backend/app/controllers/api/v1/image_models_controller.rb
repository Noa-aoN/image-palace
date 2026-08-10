module Api
  module V1
    # 絵を作るときに選べるモデル。
    #
    # 鍵の入っていないものは返さない。選んだ瞬間に失敗するものを並べても仕方がない。
    # 鍵を足せば、デプロイ無しで選べるようになる。
    class ImageModelsController < BaseController
      def index
        render json: {
          models: GenerateImageService.available_choices.map { |choice|
            choice.slice(:key, :label, :description)
          }
        }
      end
    end
  end
end
