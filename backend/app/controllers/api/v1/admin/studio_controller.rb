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
        include ItemSerialization

        before_action :require_studio!
        before_action :require_studio_strong_auth!
        # 原本の口座が無いと、**選ぶことも起こすこともできない**。
        # 落ちるのではなく、そうと言って断る
        before_action :require_owner_account!, only: [ :sources, :draft, :items, :update_exclusion ]

        # いまの様子。荷物と、原本の一覧
        def show
          render json: {
            owner: owner_summary,
            # 公式制作枠。**通常のクレジットとは別**なので、ここに出す
            allowance: current_user.studio_allowance_summary,
            packages: packages_by_key
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

        # 選べる原本。公式の口座にある箱とキャンバス。
        #
        # **受け取ったものは原本ではない。**
        # 公式の口座で自分の荷物を受け取る／下見すると、複製が公式宮殿そのものに入る。
        # 名前まで同じなので選ぶ画面では見分けが付かず、
        # **複製から公式コンテンツを作ってしまえる**
        def sources
          preview_boxes = ContentInstallation.installed_record_ids_for(official, "Box")
          preview_views = ContentInstallation.installed_record_ids_for(official, "View")

          render json: {
            boxes: official.boxes.order(:created_at)
                           .reject { |b| preview_boxes.include?(b.id) }
                           .map { |b| serialize_box(b) },
            views: official.views.order(:created_at)
                           .reject { |v| preview_views.include?(v.id) }
                           .map { |v| serialize_view(v) }
          }
        end

        # 公式宮殿のカード一覧。**1枚ずつ、出ているかどうかが分かる場所。**
        #
        # ふだん出すものは箱とキャンバスで決める。ここはその結果を見る場所で、
        # 出したくない1枚だけを外すための栓を添えてある。
        #
        # **「出す」ではなく「出さない」だけを持つ。**
        # 出すかどうかは箱の選択から導けるので、両方持つと食い違う
        def items
          rows = official.items.includes(
            :item_type, :meanings, { box_entries: :box }, { view_items: :view },
            # サムネは別の添付。**先に読まないと1枚ごとに1本増える**
            { medias: [ { file_attachment: :blob }, { thumb_attachment: :blob } ] }
          ).order(:created_at).limit(ITEM_LIMIT + 1).to_a

          # 受け取った複製はここに出さない。**ここは原本の一覧**
          preview_items = ContentInstallation.installed_record_ids_for(official, "Item")
          rows = rows.reject { |item| preview_items.include?(item.id) }

          truncated = rows.size > ITEM_LIMIT
          rows = rows.first(ITEM_LIMIT)

          excluded = ContentExclusion.item_id_set
          shipped = package_keys_by_origin

          render json: {
            items: rows.map { |item| serialize_studio_item(item, excluded, shipped) },
            excluded: excluded.size,
            truncated: truncated
          }
        end

        # 1枚だけ、出す・出さないを切り替える。
        # **効くのは次に起こす下書きから**（出した荷物は動かさない決まり）
        def update_exclusion
          item = official.items.find(params[:id])
          excluded = ActiveModel::Type::Boolean.new.cast(params[:excluded])
          ContentExclusion.set!(item: item, excluded: excluded, note: params[:note].presence)

          AdminAuditLog.record!(actor: current_user, action: "studio.item_exclusion", target: item,
                                details: { "title" => item.title, "excluded" => excluded })

          render json: { id: item.id, excluded: excluded }
        end

        # 選んだものを、下書きとして起こす。
        # **ここで欠けが見つかれば、公開の前に止まる**
        def draft
          # **受け取った複製は選べない。** 画面から外してあるが、
          # id を直に送れば通ってしまうので、こちらでも閉じる
          preview_boxes = ContentInstallation.installed_record_ids_for(official, "Box")
          preview_views = ContentInstallation.installed_record_ids_for(official, "View")

          boxes = official.boxes.where(id: params[:box_ids]).reject { |b| preview_boxes.include?(b.id) }
          views = official.views.where(id: params[:view_ids]).reject { |v| preview_views.include?(v.id) }

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
          installation, = ::Studio::Preview.start!(user: current_user, package: package)

          audit!("content_package.preview", package)
          render json: serialize_preview(installation)
        rescue ContentPackages::Payload::Error => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        # いま下見しているもの。**普通の画面に出す帯が、これを見る。**
        #
        # 下見は自分の口座に入るので、見た目は本物と変わらない。
        # 何を見ているのかが分からなくなるので、いつでも引ける形にしておく
        def current_preview
          installation = ::Studio::Preview.current(current_user)
          return render json: { active: false } if installation.nil?

          render json: serialize_preview(installation)
        end

        # 下見を終える。**荷物を問わず、いま入っている下見を片付ける。**
        #
        # 帯から押すときは、どの荷物を見ていたかを覚えていない。
        # 「終わらせる」だけで終われるようにする
        def end_preview
          ::Studio::Preview.discard!(current_user)
          head :no_content
        end

        # 下見で入れたものを片付ける（荷物を指して片付ける道）
        def discard_preview
          ::Studio::Preview.discard!(current_user)
          head :no_content
        end

        # 届け先を変える。**どこで配るか。**
        #
        # 版ではなく鍵に付ける。出し直しても設定は引き継がれる
        def update_delivery
          channel = params.require(:channel)
          enabled = ActiveModel::Type::Boolean.new.cast(params[:enabled])

          unless ContentDelivery::CHANNELS.include?(channel)
            return render json: { error: "その届け先は知りません" }, status: :unprocessable_entity
          end

          ContentDelivery.set!(package_key: params[:key], channel: channel, enabled: enabled)

          # **一般に届く先が変わる操作**なので、記録に残す
          AdminAuditLog.record!(
            actor: current_user, action: "content_package.delivery",
            details: { "key" => params[:key], "channel" => channel, "enabled" => enabled }
          )

          render json: { deliveries: ContentDelivery.state_for(params[:key]) }
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

        # 一度に返す上限。公式宮殿は自分たちで作る場所なので普段は届かないが、
        # **際限なく返す口は作らない**
        ITEM_LIMIT = 500

        # そのカードが、どの荷物に入って出ているか。
        #
        # 荷物の中身は `origin_key`（＝元のカードの id）で繋がっている。
        # 1枚ずつ探すと荷物の数だけ引くことになるので、**先に対応表を作る**
        def package_keys_by_origin
          map = Hash.new { |h, k| h[k] = [] }

          ContentPackage.published.order(:key, version: :desc).to_a.uniq(&:key).each do |package|
            Array(package.payload["items"]).each do |entry|
              key = entry["origin_key"]
              map[key] << package.key if key.present?
            end
          end

          map
        end

        # **出せない理由も一緒に返す。**
        # 下書きを起こしてから止まるより、並べた時点で分かるほうがよい
        def serialize_studio_item(item, excluded, shipped)
          media = item.primary_media

          {
            id: item.id,
            title: item.title,
            item_type: item.item_type&.label || item.item_type&.name,
            thumb_url: media && serialize_media(media)&.dig(:thumb_url),
            boxes: item.box_entries.filter_map { |e| e.box&.name }.uniq,
            views: item.view_items.filter_map { |v| v.view&.name }.uniq,
            packages: shipped[item.id],
            excluded: excluded.include?(item.id),
            blockers: blockers_for(item, media)
          }
        end

        def blockers_for(item, media)
          blockers = []
          blockers << "絵がありません" if media.nil? || !media.file.attached?
          blockers << "意味がありません" if item.meanings.empty?
          blockers << "種別がありません" if item.item_type&.name.blank?
          blockers
        end

        def find_package!
          ContentPackage.find_by(key: params[:key], version: params[:version]) ||
            ContentPackage.latest_published(params[:key]) ||
            raise(ActiveRecord::RecordNotFound)
        end

        def publish!(package)
          package.draft? ? package.publish_draft! : package.resume!
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

        # 体験用に置いている荷物。**入口を開ける前に、中身があるか分かるように**
        def demo_package_state
          packages = ::Demo::Session.packages
          return { published: false, packages: [] } if packages.empty?

          {
            published: true,
            packages: packages.map { |p| { key: p.key, name: p.name, version: p.version,
                                           items: p.summary_counts[:items] } },
            items: packages.sum { |p| p.summary_counts[:items] }
          }
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

        # 一覧は**鍵ごとに1行**。版ごとに並べない。
        #
        # 届け先も受け取りも鍵に付くので、版ごとに並べると
        # 同じ設定が何行も出て、どれを押せばよいのか分からなくなる。
        # 前の版は `history` に畳む
        def packages_by_key
          ContentPackage.ordered.group_by(&:key).map do |_key, versions|
            serialize_package(versions.first).merge(
              history: versions.drop(1).map { |p| serialize_history(p) }
            )
          end
        end

        def serialize_package(package)
          {
            id: package.id, key: package.key, version: package.version,
            kind: package.kind, status: package.status,
            name: package.name, summary: package.summary,
            counts: package.summary_counts,
            published_at: package.published_at,
            updated_at: package.updated_at,
            # どこへ届けるか。**種別とは別**（種別は「何であるか」）
            deliveries: ContentDelivery.state_for(package.key),
            # いま実際に配られている版。下書きを起こした直後は、この行の版とずれる
            delivering_version: ContentPackage.latest_published(package.key)&.version,
            # 何人が受け取ったか（下見は数えない）
            installs: installs_for(package)
          }
        end

        # 下見の様子。**開く先と、いつ消えるかまで返す。**
        # 帯にも工房室にも同じ形を渡す
        def serialize_preview(installation)
          points = ::Studio::Preview.entry_points(installation)
          package = installation.package

          {
            active: true,
            key: installation.package_key,
            version: installation.package_version,
            name: package&.name,
            # **何を見ているのかを、色ではなく文字で言えるように。**
            # 下書きの下見と、出しているものの下見は、意味がまるで違う
            status: package&.status,
            box_id: points[:box_id],
            view_id: points[:view_id],
            items: installation.entries.where(record_type: "Item").count,
            expires_at: ::Studio::Preview.expires_at(installation),
            # 原本が作り直されている＝いま見ているものは古い
            stale: ::Studio::Preview.stale?(installation)
          }
        end

        def serialize_history(package)
          {
            id: package.id, version: package.version, status: package.status,
            published_at: package.published_at, installs: installs_for(package)
          }
        end

        # 何人が受け取ったか。**一時的なものは数えない**
        # （下見も、使い捨ての体験用の宮殿も、配った数ではない）
        def installs_for(package)
          ContentInstallation.counted
                             .where(package_key: package.key, package_version: package.version).count
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
