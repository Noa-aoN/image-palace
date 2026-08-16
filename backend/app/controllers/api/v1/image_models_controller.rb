module Api
  module V1
    # 絵を作るときに選べるモデル。
    #
    # 鍵の入っていないものは返さない。選んだ瞬間に失敗するものを並べても仕方がない。
    # 鍵を足せば、デプロイ無しで選べるようになる。
    class ImageModelsController < BaseController
      def index
        # どれが既定かを添える。**画面側で当てさせない。**
        # 既定は登録簿と環境変数で動くので、名前を画面に書き写すと必ずずれる
        default_key = GenerateImageService.default_model&.key

        render json: {
          models: GenerateImageService.available_choices.map { |choice|
            choice.slice(:key, :label, :description).merge(default: choice.key == default_key)
          }
        }
      end
    end
  end
end
