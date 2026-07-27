module Api
  module V1
    # スペースのポイント（loci の点）。序数＋ポイント名を持ち、名前から画像を生成する。
    # road は序数順、room は間取り（x/y）で配置する想定。カードの割当も保持する（暫定）。
    class SpacePointsController < BaseController
      include ItemSerialization

      before_action :set_space
      before_action :set_point, only: [ :update, :destroy ]

      # 末尾にポイントを追加。name があればそのポイントの画像生成を開始する。
      def create
        name = stripped_name
        return render_insufficient_credits if name.present? && insufficient_credits?

        point = @space.space_points.create!(position: next_position, name: name)
        if point.name.present?
          current_user.consume_credits!(point_cost, space_point_id: point.id)
          enqueue_generation(point)
        end
        render json: serialize_point(point), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # カードの割当/クリア（item_id）・序数の変更（position）・ポイント名の変更（name）・
      # 間取り座標の変更（x/y、room のドラッグ配置）。名前が新たに付く/変わると画像を（再）生成する。
      def update
        assign_item if params.key?(:item_id)
        @point.position = params[:position] if params.key?(:position)
        @point.x = params[:x] if params.key?(:x)
        @point.y = params[:y] if params.key?(:y)
        @point.surface = params[:surface] if params.key?(:surface)
        @point.u = params[:u] if params.key?(:u)
        @point.v = params[:v] if params.key?(:v)

        will_generate = name_will_generate?
        return render_insufficient_credits if will_generate && insufficient_credits?

        @point.name = stripped_name if params.key?(:name)
        @point.generation_status = "pending" if will_generate
        @point.save!
        if will_generate
          current_user.consume_credits!(point_cost, space_point_id: @point.id)
          enqueue_generation(@point)
        end
        render json: serialize_point(@point.reload)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @point.destroy!
        head :no_content
      end

      # 並び替え: ordered_ids の順に position を 1..N で振り直す
      def reorder
        ids = Array(params[:ordered_ids])
        SpacePoint.transaction do
          ids.each_with_index do |id, index|
            @space.space_points.where(id: id).update_all(position: index + 1, updated_at: Time.current)
          end
        end
        head :no_content
      end

      private

      def set_space
        @space = current_user.spaces.find(params[:space_id])
      end

      def set_point
        @point = @space.space_points.find(params[:id])
      end

      def assign_item
        item_id = params[:item_id]
        @point.item = item_id.present? ? current_user.items.find(item_id) : nil
      end

      def stripped_name
        params[:name].to_s.strip if params.key?(:name)
      end

      # 画像生成を走らせるか。
      # generate を明示した場合はそれに従う（true=名前があれば必ず生成／false=生成せず名前だけ保存）。
      # 未指定なら従来どおり「名前が変わった／前回失敗からの再試行」のとき生成する
      # （同じ名前で生成済みは再生成しない＝同一プロンプトはキャッシュで同結果）。
      def name_will_generate?
        return false unless params.key?(:name)

        if params.key?(:generate)
          return false unless ActiveModel::Type::Boolean.new.cast(params[:generate])
          return stripped_name.present?
        end

        name = stripped_name
        return false if name.blank?

        name != @point.name || @point.generation_status == "failed"
      end

      def next_position
        (@space.space_points.maximum(:position) || 0) + 1
      end

      def enqueue_generation(point)
        GeneratePointImageJob.perform_later(point.id)
      end

      def point_cost
        ::Billing::CreditCost.call(kind: :point_generation)
      end

      # 当月分の無料枠を付与したうえで、ポイント生成1件分のクレジットが足りないか
      def insufficient_credits?
        current_user.ensure_current_period_credits!
        current_user.available_credit_points < point_cost
      end

      def render_insufficient_credits
        render json: { error: "クレジットが不足しています" }, status: :unprocessable_entity
      end
    end
  end
end
