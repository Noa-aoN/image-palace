module Api
  module V1
    module Admin
      # 工房室。**公式コンテンツを、選んで・確かめて・出す場所。**
      #
      # ここに編集の道具は置かない。カードを足したいなら公式の口座で普通に足せばよく、
      # 同じものをもう一度作ることになる。
      #
      #   公式宮殿で作る → 選ぶ → 下書きを起こす → 下見する → 公開する
      #
      # **公式宮殿にあるもの全部が、公開物ではない。**
      # 宮殿は原本・制作の場として自由に使い、その中から出すものだけをここで選ぶ。
      class StudioController < Api::V1::BaseController
        before_action :require_studio!
        before_action :require_studio_strong_auth!
        # 原本の口座が無いと、**選ぶことも起こすこともできない**。
        # 落ちるのではなく、そうと言って断る
        before_action :require_owner_account!, only: [ :sources, :draft ]

        # いまの様子。荷物と、原本の一覧
        def show
          render json: {
            owner: owner_summary,
            # 公式制作枠。**通常のクレジットとは別**なので、ここに出す
            allowance: current_user.studio_allowance_summary,
            packages: ContentPackage.ordered.map { |p| serialize_package(p) }
          }
        end

        # 工房の設定。**ここだけで完結する**ようにする。
        #
        # 枠の上限も体験の入口も、執務室（`/admin`）の奥にある。
        # だが制作だけの人は執務室に入れないので、**同じ栓をここにも出す**。
        # 触っているのは同じ行なので、どちらから変えても効く
        def settings
          render json: {
            official_account: official_account_state,
            allowance_limit_credits: GrantPolicy.amount_for(StudioAllowance::POLICY_KEY),
            demo_entry_stage: FeatureFlag.stages["demo_entry"],
            demo_entry_stages: FeatureFlag::STAGES,
            demo_package: demo_package_state
          }
        end

        def update_settings
          if params.key?(:allowance_limit_credits)
            update_allowance_limit!(params[:allowance_limit_credits].to_i)
          end
          update_demo_stage!(params[:demo_entry_stage]) if params.key?(:demo_entry_stage)

          settings
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        # 選べる原本。公式の口座にある箱とキャンバス
        def sources
          render json: {
            boxes: official.boxes.order(:created_at).map { |b| serialize_box(b) },
            views: official.views.order(:created_at).map { |v| serialize_view(v) }
          }
        end

        # 選んだものを、下書きとして起こす。
        # **ここで欠けが見つかれば、公開の前に止まる**
        def draft
          boxes = official.boxes.where(id: params[:box_ids])
          views = official.views.where(id: params[:view_ids])

          if boxes.empty? && views.empty?
            return render json: { error: "箱かキャンバスを1つ以上選んでください" }, status: :unprocessable_entity
          end

          payload = ContentPackages::Exporter.call(boxes: boxes, views: views)
          package = ContentPackage.draft!(
            key: params.require(:key), kind: params.require(:kind), name: params.require(:name),
            summary: params[:summary].presence, cover_image_key: params[:cover_image_key].presence,
            payload: payload
          )

          audit!("content_package.draft", package)
          render json: { package: serialize_package(package) }, status: :created
        rescue ContentPackages::Payload::Error => e
          render json: { error: e.message }, status: :unprocessable_entity
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        # 下見。**自分の口座へ入れて、受け取った人と同じ画面で見る。**
        #
        # 出す前に、実際の見え方を確かめられるようにするため。
        # 何度でも押せるように、前回の下見は先に片付ける
        def preview
          package = find_package!
          discard_previous_preview!(package)

          result = ContentPackages::Importer.call(user: current_user, payload: package.payload)
          record_preview!(package, result)

          audit!("content_package.preview", package)
          render json: {
            box_id: result.boxes.first&.id,
            view_id: result.views.first&.id,
            items: result.created_items.size
          }
        rescue ContentPackages::Payload::Error => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # 下見で入れたものを片付ける
        def discard_preview
          package = find_package!
          discard_previous_preview!(package)
          head :no_content
        end

        # 扱いを変える。publish / suspend / resume / archive
        def update_status
          package = find_package!
          action = params.require(:status_action)

          case action
          when "publish" then publish!(package)
          when "suspend" then package.suspend!
          when "resume" then package.resume!
          when "archive" then package.archive!
          else return render json: { error: "その操作は知りません" }, status: :unprocessable_entity
          end

          audit!("content_package.#{action}", package)
          render json: { package: serialize_package(package.reload) }
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def require_studio!
          return if current_user&.can_access_official_studio?

          Rails.logger.warn "[Studio] FORBIDDEN user_id=#{current_user&.id} path=#{request.path}"
          render json: { error: "工房室を使う権限がありません" }, status: :forbidden
        end

        # 工房に入る前に、もう一度ご本人か確かめる。**執務室と同じ考え方。**
        #
        # ここは公開まで届く場所で、原本の持ち主も入れるようにした。
        # **合鍵ひとつで公開まで開くのを避ける。**
        # 一次認証の情報は漏れうるが、手元の鍵（Passkey・認証アプリ）まで
        # 同時に奪うのは桁違いに難しい。
        #
        # 求めない設定（既定）のときは、これまでどおり素通りする
        def require_studio_strong_auth!
          return unless ::Auth::StrongAuth.admin_required?
          return if strongly_authenticated?(within: StrongAuthSession::ADMIN_WINDOW)

          methods = ::Auth::StrongAuth.available_methods(current_user)

          if methods.any?
            render json: {
              error: "工房室に入る前に、もう一度ご本人か確かめさせてください。",
              code: "strong_auth_required",
              methods: methods
            }, status: :forbidden
          else
            render json: {
              error: "工房室に入るには、パスキーか認証アプリの設定が必要です。",
              code: "strong_auth_setup_required",
              methods: []
            }, status: :forbidden
          end
        end

        # 原本が無いと、選ぶ画面は出せない
        def require_owner_account!
          return if official

          render json: {
            error: "公式コンテンツの口座が設定されていません",
            code: "official_account_missing"
          }, status: :service_unavailable
        end

        def official
          @official ||= User.official_content_account
        end

        def find_package!
          ContentPackage.find_by(key: params[:key], version: params[:version]) ||
            ContentPackage.latest_published(params[:key]) ||
            raise(ActiveRecord::RecordNotFound)
        end

        def publish!(package)
          package.draft? ? package.publish_draft! : package.resume!
        end

        # 下見は**その人の口座に入る**ので、跡を残して片付けられるようにする。
        # 印は受け取りの記録に付ける（`source: "preview"`）
        def record_preview!(package, result)
          installation = ContentInstallation.create!(
            user: current_user, package_key: package.key, package_version: package.version,
            source: "preview", installed_at: Time.current
          )
          rows = result.items_by_local_key.map do |local_key, item|
            { content_installation_id: installation.id, record_type: "Item", record_id: item.id,
              package_local_key: local_key, origin_key: result.origin_keys[local_key] }
          end
          (result.boxes + result.views).each do |record|
            rows << { content_installation_id: installation.id, record_type: record.class.name,
                      record_id: record.id, package_local_key: nil, origin_key: nil }
          end
          now = Time.current
          ContentInstallationEntry.insert_all!(rows.map { |r| r.merge(created_at: now, updated_at: now) })
        end

        # 前の下見を片付ける。**カードごと消す**（残すと本物と混ざる）
        def discard_previous_preview!(package)
          previous = ContentInstallation.where(
            user_id: current_user.id, package_key: package.key, source: "preview"
          )
          previous.each do |installation|
            installation.entries.each do |entry|
              entry.record&.destroy
            rescue StandardError => e
              Rails.logger.warn "[Studio] 下見の片付けに失敗: #{e.class}: #{e.message}"
            end
            installation.destroy!
          end
        end

        def update_allowance_limit!(credits)
          return if credits.negative?

          policy = GrantPolicy.find_or_initialize_by(key: StudioAllowance::POLICY_KEY)
          policy.assign_attributes(reward_type: "credits", amount: credits, enabled: true)
          policy.save!

          AdminAuditLog.record!(actor: current_user, action: "studio.allowance_limit",
                                details: { "credits" => credits })
        end

        def update_demo_stage!(stage)
          return unless FeatureFlag::STAGES.include?(stage)

          flag = FeatureFlag.find_or_initialize_by(key: "demo_entry")
          flag.update!(stage: stage)

          # **一般に開ける操作**なので、記録に残す
          AdminAuditLog.record!(actor: current_user, action: "studio.demo_entry",
                                details: { "stage" => stage })
        end

        def official_account_state
          return { configured: false } unless official

          { configured: true, email: official.email, items: official.items.count }
        end

        # 体験用に配っている荷物。**入口を開ける前に、中身があるか分かるように**
        def demo_package_state
          package = ContentPackage.latest_published(::Demo::Session::PACKAGE_KEY)
          return { published: false } unless package

          { published: true, key: package.key, version: package.version, counts: package.summary_counts }
        end

        def audit!(action, package)
          AdminAuditLog.record!(
            actor: current_user, action: action, target: package,
            details: { "key" => package.key, "version" => package.version, "status" => package.status }
          )
        end

        # ── 画面へ渡す形 ──────────────────────────────

        def owner_summary
          return nil unless official

          {
            email: official.email,
            boxes: official.boxes.count,
            views: official.views.count,
            items: official.items.count
          }
        end

        def serialize_package(package)
          {
            id: package.id, key: package.key, version: package.version,
            kind: package.kind, status: package.status,
            name: package.name, summary: package.summary,
            counts: package.summary_counts,
            published_at: package.published_at,
            updated_at: package.updated_at,
            # 何人が受け取ったか（下見は数えない）
            installs: ContentInstallation.where(package_key: package.key, package_version: package.version)
                                         .where.not(source: "preview").count
          }
        end

        def serialize_box(box)
          { id: box.id, name: box.name, description: box.description, items: box.box_entries.count }
        end

        def serialize_view(view)
          {
            id: view.id, name: view.name, view_type: view.view_type,
            items: view.view_items.count, edges: view.view_edges.count,
            # 宮殿に結びついたキャンバスは、まだ運べない
            portable: view.space_id.nil?
          }
        end
      end
    end
  end
end
