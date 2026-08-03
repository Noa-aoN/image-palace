module Api
  module V1
    module Admin
      # 利用者の一覧と、役割の付け外し。
      #
      # 一覧は運営が見るものなので連絡先まで出すが、それ以上は出さない。
      # 役割の変更は owner だけが行え、必ず監査ログに残る。
      class UsersController < BaseController
        before_action :require_owner!, only: [ :update_role ]

        DEFAULT_PER = 25
        MAX_PER = 100

        def index
          scope = filtered_users
          total = scope.count
          users = scope.order(created_at: :desc).offset((page - 1) * per).limit(per).to_a
          counts = item_counts_for(users)

          render json: {
            users: users.map { |user| serialize_user(user, counts[user.id].to_i) },
            meta: { page: page, per: per, total_count: total, total_pages: (total.to_f / per).ceil }
          }
        end

        # 役割を変える（owner のみ）。譲渡もここで行う。
        def update_role
          user = User.find(params[:id])
          role = params[:role].to_s
          return render_error("知らない役割です") unless User::ROLES.include?(role)
          return render_error("自分の役割は変えられません") if user.id == current_user.id
          if user.bootstrap_owner?
            return render_error("環境変数で運営の管理者に指定されているため、画面からは変えられません")
          end

          previous = user.role
          user.update!(role: role)
          audit!("user.role_changed", target: user, details: { from: previous, to: role, email: user.email })
          render json: serialize_user(user, user.items.count)
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        private

        def filtered_users
          scope = User.all
          query = params[:q].to_s.strip
          scope = scope.where("email ILIKE :q OR name ILIKE :q", q: "%#{query}%") if query.present?
          scope = scope.where(role: params[:role]) if User::ROLES.include?(params[:role].to_s)
          scope
        end

        # 一覧のカード枚数はまとめて1クエリで数える（人数ぶん問い合わせない）
        def item_counts_for(users)
          return {} if users.empty?

          Item.where(user_id: users.map(&:id)).group(:user_id).count
        end

        def serialize_user(user, item_count)
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.effective_role,
            # 環境変数由来の owner は画面から変えられないので、その旨を伝える
            role_locked: user.bootstrap_owner?,
            confirmed: user.confirmed_at.present?,
            provider: user.provider,
            items: item_count,
            available_credits: user.available_credits,
            plan: user.active_subscription&.plan&.name,
            created_at: user.created_at
          }
        end

        def render_error(message)
          render json: { error: message }, status: :unprocessable_entity
        end

        def page
          [ params[:page].to_i, 1 ].max
        end

        def per
          requested = params[:per].to_i
          return DEFAULT_PER if requested <= 0

          [ requested, MAX_PER ].min
        end
      end
    end
  end
end
