module Api
  module V1
    module Admin
      # 利用者の一覧と、役割の付け外し。
      #
      # 一覧は運営が見るものなので連絡先まで出すが、それ以上は出さない。
      # 役割の変更は owner だけが行え、必ず監査ログに残る。
      class UsersController < BaseController
        before_action :require_owner!, only: [ :update_role ]
        # 権限を触るのは、乗っ取られたときの被害がいちばん大きい操作。
        # 直近に本人か確かめていることを求める
        before_action :require_strong_auth!, only: [ :update_role ]

        DEFAULT_PER = 25
        MAX_PER = 100

        def index
          scope = filtered_users
          total = scope.count
          users = scope.order(created_at: :desc).offset((page - 1) * per).limit(per).to_a
          counts = item_counts_for(users)

          render json: {
            users: users.map { |user| serialize_user(user, counts[user.id].to_i) },
            # 期間の決め方は他の運営画面と共通。ここでは「いつ登録した人か」で絞る
            period: period.to_h.merge(options: ::Admin::Period.options),
            meta: { page: page, per: per, total_count: total, total_pages: (total.to_f / per).ceil },
            # 一覧は「いま誰がいるか」しか分からない。伸びているのかは別に数字で出す
            stats: stats
          }
        end

        # 役割を変える（admin のみ）。譲渡もここで行う。
        def update_role
          user = User.find(params[:id])
          role = params[:role].to_s
          return render_error("知らない役割です") unless User::ROLES.include?(role)
          return render_error("自分の役割は変えられません") if user.id == current_user.id
          if user.bootstrap_admin?
            return render_error("環境変数で運営の管理者に指定されているため、画面からは変えられません")
          end
          # 最上位が居なくなる変更は通さない。権限を戻せる人が画面から消える
          if User.last_admin?(user) && User::ROLE_RANK.fetch(role) < User::ROLE_RANK.fetch("admin")
            return render_error("最後の管理者は降格できません。先に別の人を管理者にしてください。")
          end

          previous = user.role
          user.update!(role: role)
          audit!("user.role_changed", target: user, details: { from: previous, to: role, email: user.email })
          render json: serialize_user(user, user.items.count)
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        private

        # 折れ線に出す月数
        TREND_MONTHS = 12

        # 利用者の伸び。絞り込みに関係なく全体の数字を返す（一覧の下に出す前提）。
        #
        # **中の人の口座は数えない。** 体験用と公式コンテンツ用が混ざると、
        # 伸びているように見えて実は増えていない、が起きる。
        # 一覧そのものには出す（運営から見えないほうが困る）
        def stats
          now = Time.current
          this_month = User.external.where(created_at: now.beginning_of_month..).count
          last_month = User.external.where(created_at: (now - 1.month).beginning_of_month...now.beginning_of_month).count
          total = User.external.count

          {
            total: total,
            confirmed: User.external.where.not(confirmed_at: nil).count,
            admins: User.effective_admins.count,
            new_this_month: this_month,
            new_last_month: last_month,
            # 前月比。前月が0なら率を出さない（分母0は「無限に増えた」ではない）
            growth_rate: last_month.positive? ? ((this_month - last_month).fdiv(last_month) * 100).round(1) : nil,
            monthly: monthly_series(now, total)
          }
        end

        # 月ごとの新規と、その時点の累計
        def monthly_series(now, total)
          start = (now - (TREND_MONTHS - 1).months).beginning_of_month
          counts = User.where(created_at: start..)
                       .group(Arel.sql("DATE_TRUNC('month', created_at)"))
                       .count
                       .transform_keys { |key| key.to_date.strftime("%Y-%m") }

          # 期間より前に登録した人数を起点に、累計を積み上げる
          running = total - counts.values.sum

          (0...TREND_MONTHS).map do |offset|
            date = start + offset.months
            key = date.strftime("%Y-%m")
            count = counts[key].to_i
            running += count
            { month: key, count: count, cumulative: running }
          end
        end

        def period
          # 既定は全期間。利用者は探しに来る面なので、既定で古い人が消えると使えない
          @period ||= ::Admin::Period.resolve(params[:period], default: ::Admin::Period::ALL)
        end

        def filtered_users
          scope = User.where(created_at: period.range)
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
            role_locked: user.bootstrap_admin?,
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
