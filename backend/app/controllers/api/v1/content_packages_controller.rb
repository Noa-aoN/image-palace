module Api
  module V1
    # 公式コンテンツの受け取り。
    #
    # デルフォイの「公式コンテンツの受け取り」から呼ばれる。
    # 配る仕組みそのものは `ContentPackages::Distributor` にあり、
    # **デモも、登録直後の持ち帰りも、将来のミッション報酬も同じ道を通る。**
    class ContentPackagesController < BaseController
      # 受け取れるもの。**中身を開かずに数だけ分かる**ようにして返す
      def index
        packages = ContentPackage.distributable(kind: "starter")
        received = ContentInstallation.where(user_id: current_user.id).pluck(:package_key).to_set

        render json: {
          packages: packages.map { |p| serialize(p, received) },
          # あと何個、無料で受け取れるか
          free_remaining: free_remaining
        }
      end

      def install
        result = ContentPackages::Distributor.call(
          user: current_user, key: params[:key], source: "delphi"
        )

        render json: {
          box_id: result.imported.boxes.first&.id,
          view_id: result.imported.views.first&.id,
          created: result.created_count,
          reused: result.reused_count,
          package: serialize(result.package, Set.new)
        }, status: :created
      rescue ContentPackages::Distributor::AlreadyInstalled,
             ContentPackages::Distributor::FreeLimitReached => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ContentPackages::Distributor::NotDistributable => e
        render json: { error: e.message }, status: :not_found
      end

      private

      def serialize(package, received)
        counts = package.summary_counts
        {
          key: package.key,
          version: package.version,
          name: package.name,
          summary: package.summary,
          cover_image_key: package.cover_image_key,
          counts: counts,
          received: received.include?(package.key)
        }
      end

      def free_remaining
        used = ContentInstallation.free.where(user_id: current_user.id).count
        [ ContentInstallation::FREE_LIMIT - used, 0 ].max
      end
    end
  end
end
