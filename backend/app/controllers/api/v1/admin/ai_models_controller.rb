module Api
  module V1
    module Admin
      # AI モデルの登録簿。登録・有効/無効・既定・表示・原価・消費クレジット・
      # 用途・1日の上限を、1つの表で扱う。
      class AiModelsController < BaseController
        def index
          render json: {
            models: AiModel.registry.map { |model| serialize(model, usage) },
            # 期間の決め方は概要ページと共通（Admin::Period）。
            # ページごとに別の窓を持つと、同じ「7月」で違う範囲を見ることになる
            period: period.to_h.merge(options: ::Admin::Period.options),
            usage_days: period.days,
            kinds: AiModel::KINDS,
            providers: GenerateImageService::PROVIDERS.keys,
            purposes: AiModel::IMAGE_PURPOSES,
            # 消費クレジットの単位を画面に出すため
            points_per_credit: ::Billing::POINTS_PER_CREDIT
          }
        end

        def create
          model = AiModel.new(model_params)

          if model.save
            audit!("ai_model_create", details: { key: model.key, kind: model.kind })
            render json: { model: serialize(model) }, status: :created
          else
            render json: { errors: model.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def update
          model = AiModel.find(params[:id])
          before = model.slice(:enabled, :visible, :default_for_kind, :credit_points, :unit_cost_usd)

          # 既定はその種類に1つだけ。2つ立つと、どちらで作られたのか分からなくなる
          AiModel.where(kind: model.kind).where.not(id: model.id).update_all(default_for_kind: false) if
            ActiveModel::Type::Boolean.new.cast(model_params[:default_for_kind])

          if model.update(model_params.except(:key))
            audit!("ai_model_update", details: { key: model.key, before: before })
            render json: { model: serialize(model) }
          else
            render json: { errors: model.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # 組み込みは消さない（コードが key を参照している）。止めたいときは無効にする
        def destroy
          model = AiModel.find(params[:id])
          if model.builtin?
            return render json: { error: "組み込みのモデルは削除できません。無効にしてください。" },
                          status: :unprocessable_entity
          end

          model.destroy!
          audit!("ai_model_destroy", details: { key: model.key })
          head :no_content
        end

        private

        def model_params
          params.require(:ai_model).permit(
            :key, :kind, :provider, :model_id, :label, :description,
            :enabled, :visible, :default_for_kind,
            :credit_points, :unit_cost_usd, :output_cost_usd, :daily_limit,
            :requires_env, :notes, :position, purposes: []
          )
        end

        def period
          @period ||= ::Admin::Period.resolve(params[:period])
        end

        # モデル名ごとの使用回数。画像と文章をまとめて1回ずつ数える。
        # 1行ごとに数えるとモデルの数だけ問い合わせが飛ぶ
        def usage
          @usage ||= begin
            range = period.from...period.to
            images = ImageUsage.where(created_at: range).group(:model).count
            cached = ImageUsage.where(created_at: range).where(cached: true).group(:model).count
            texts = AiUsage.where(created_at: range).group(:model).count
            { images: images, cached: cached, texts: texts,
              image_total: images.values.sum, text_total: texts.values.sum }
          end
        end

        def recent_count(model, stats)
          model.kind == "image" ? stats[:images][model.model_id].to_i : stats[:texts][model.model_id].to_i
        end

        # その種類（画像／文章）の中での割合。分母が0なら null
        # （0% と出すと、使われていないのか分母が無いのかが分からない）
        def share_of(model, stats)
          total = model.kind == "image" ? stats[:image_total] : stats[:text_total]
          return nil if total.zero?

          recent_count(model, stats).fdiv(total).round(3)
        end

        def serialize(model, stats = usage)
          {
            id: model.id,
            key: model.key,
            kind: model.kind,
            provider: model.provider,
            model_id: model.model_id,
            label: model.label,
            description: model.description,
            enabled: model.enabled,
            visible: model.visible,
            default_for_kind: model.default_for_kind,
            purposes: model.purposes,
            credit_points: model.credit_points,
            unit_cost_usd: model.unit_cost_usd&.to_f,
            output_cost_usd: model.output_cost_usd&.to_f,
            daily_limit: model.daily_limit,
            requires_env: model.requires_env,
            notes: model.notes,
            position: model.position,
            builtin: model.builtin?,
            # 鍵が入っていないと、有効にしていても実際には使えない
            available: model.available?,
            used_today: model.kind == "image" ? ImageUsage.where(model: model.model_id, created_at: Time.current.beginning_of_day..).count : nil,
            # 直近の使用回数と、その種類の中での割合。
            # 割合まで出すのは、回数だけだと「よく使われている」が読み取れないため
            used_recently: recent_count(model, stats),
            share: share_of(model, stats),
            # キャッシュで済んだぶん（API を呼んでいない）。原価の読み方が変わる
            cached_recently: model.kind == "image" ? stats[:cached][model.model_id].to_i : nil
          }
        end
      end
    end
  end
end
