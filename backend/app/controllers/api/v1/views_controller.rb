module Api
  module V1
    class ViewsController < BaseController
      include ListPagination
      include ItemSerialization
      # デッキを「一覧と同じ札」で見せるため、札の作り方を借りる
      include CardListSerialization
      include CoverImageUpload
      include CoverImageGeneration

      before_action :set_view, only: [
        :show, :update, :destroy, :add_item, :update_item, :remove_item, :reorder, :place_on_point, :clear_point,
        :upload_cover, :remove_cover, :generate_cover, :ai_edit, :card_proposal, :create_cards,
        :undo, :redo, :upload_background, :remove_background
      ]

      def index
        # cover/cover_cards は各ビューの先頭数枚しか使わない。
        # view_items を全件 preload すると配置カードの数に比例して重くなるため、
        # 必要数の取得はモデル側（cover_item_candidates）に任せる。
        views = current_user.views.recent
                            .includes(cover_item: MEDIA_INCLUDES)
                            .with_attached_cover_image.with_attached_cover_thumb

        views = filter_by_name(views)
        views = views.where(view_type: params[:type]) if View::VIEW_TYPES.include?(params[:type].to_s)
        views, next_cursor = paginate_list(views)
        View.preload_cover_items(views)
        # 置いてあるカードの数。一覧で「中身が多い順」に並べるのに要る。
        # 1件ずつ数えると件数ぶん問い合わせが飛ぶので、まとめて1回で数える
        counts = ViewItem.where(view_id: views.map(&:id)).group(:view_id).count
        render json: {
          views: views.map { |v| serialize_view(v).merge(item_count: counts[v.id].to_i) },
          next_cursor: next_cursor
        }
      end

      def show
        render json: serialize_view_detail(@view)
      end

      # キャンバスを作る。**カードも一緒に入れられる。**
      #
      # 選んだカードから作る導線があるので、作ってから1枚ずつ入れると
      # 50枚で51往復になる。往復の本数がそのまま待ち時間になるため、
      # 作成と同時に受け取れるようにする。
      def create
        view = current_user.views.build(view_params)
        ActiveRecord::Base.transaction do
          view.save!
          place_items!(view, params[:item_ids])
        end
        render json: serialize_view(view), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @view.assign_attributes(view_update_params)
        validate_cover!
        @view.save!
        render json: serialize_view(@view)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @view.destroy!
        head :no_content
      end

      # フリーボードにカードを配置する
      def add_item
        # まとめて足す道。一覧で選んだ 50 枚を入れるのに 50 往復させない
        # （この製品の遅さは往復の本数で決まる）。作成時と同じ規則を通す
        if params[:item_ids].present?
          added = 0
          ActiveRecord::Base.transaction { added = place_items!(@view, params[:item_ids]) }
          return render json: { added: added }, status: :created
        end

        item = current_user.items.find(params[:item_id])
        view_item = @view.view_items.find_or_initialize_by(item_id: item.id)
        if @view.deck?
          # deck はカードを末尾に追加（順序は position。座標は既定 0）。
          view_item.position ||= next_deck_position
        else
          view_item.assign_attributes(placement_params)
        end
        view_item.save!
        render json: serialize_placement(view_item.tap { |vi| vi.item = item }), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # 渡されたカードをまとめて置く。
      #
      # **持ち主のものだけ。** id を並べて送れる口なので、
      # ここで絞らないと他人のカードを自分の板へ引き込めてしまう。
      #
      # 並びは**渡された順**。選んだ順に意味があることがある（デッキの並びなど）。
      # 空間配置（space_map）は点を選ばないと置けないので、ここでは入れない。
      def place_items!(view, item_ids)
        ids = Array(item_ids).map(&:to_s).uniq
        return 0 if ids.empty? || view.space_map?

        owned = current_user.items.where(id: ids).pluck(:id)
        # 送られた順を保つ（where の結果順は保証されない）
        ordered = ids & owned.map(&:to_s)

        # **既にあるものは飛ばす。** 作成時は空なので効かないが、
        # あとから足す道では、同じカードを選び直すたびに増えてしまう
        already = view.view_items.where(item_id: ordered).pluck(:item_id).map(&:to_s).to_set
        fresh = ordered.reject { |id| already.include?(id) }

        # 並びは末尾へ継ぐ。1 から振り直すと、先にあったカードと番号がぶつかる
        base = view.view_items.maximum(:position) || 0
        fresh.each_with_index do |item_id, index|
          view.view_items.create!(item_id: item_id, position: base + index + 1)
        end
        fresh.size
      end

      # 配置（座標・重なり順）を更新する
      def update_item
        view_item = @view.view_items.find_by!(item_id: params[:item_id])
        view_item.update!(placement_params)
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # deck: カードの並び替え（ordered_item_ids の順に position を 1..N で振り直す）
      def reorder
        ids = Array(params[:ordered_item_ids])
        ViewItem.transaction do
          ids.each_with_index do |item_id, index|
            # デッキは position（先頭=1）。フリーボード等はレイヤー＝z_index（先頭=手前=最大）。
            attrs = @view.deck? ? { position: index + 1 } : { z_index: ids.size - index }
            @view.view_items.where(item_id: item_id).update_all(**attrs, updated_at: Time.current)
          end
        end
        head :no_content
      end

      # カードを外す
      def remove_item
        @view.view_items.find_by(item_id: params[:item_id])&.destroy!
        # そのカードを端点に持つ接続線も掃除する（孤児 edge を残さない）
        @view.view_edges.where("source_node_id = :id OR target_node_id = :id", id: params[:item_id]).delete_all
        head :no_content
      end

      # space_map: スペースのポイントにカードを配置する。
      # 1 ポイント 1 カード（差し替え可）。同じカードは複数ポイントに置ける（再利用可）。
      def place_on_point
        point = view_space_point!
        item = current_user.items.find(params[:item_id])

        placement = @view.view_items.find_or_initialize_by(space_point_id: point.id)
        placement.item = item
        placement.save!
        render json: serialize_point_placement(point, placement), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/views/:id/cover_image （multipart: cover_image）
      def upload_cover
        file = params[:cover_image]
        return render(json: { errors: [ "画像が指定されていません" ] }, status: :unprocessable_entity) if file.blank?

        attach_optimized_cover!(@view, file)
        @view.update!(cover_type: "custom")
        render json: serialize_view(@view)
      rescue CoverImageUpload::InvalidCover => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # POST /api/v1/views/:id/cover_image/generate
      # ことばからカバー画像を作る（非同期・1クレジット）。
      def generate_cover
        generate_cover_for(@view) { |record| render json: serialize_view(record), status: :accepted }
      end

      # POST /api/v1/views/:id/ai_edit
      # ことばの指示でキャンバスを組み立て直す（デッキ / フリーボード）。
      # mode=select は使うカードを選ぶところから、placed_only はいまあるカードだけで組み直す。
      def ai_edit
        # 調整の前に控えを取る。思ったものと違ったときに戻せるようにする
        Views::RevisionService.snapshot!(@view, label: "AI調整の前")
        result = Views::AiEditService.call(
          view: @view,
          instruction: params.dig(:edit, :instruction),
          mode: params.dig(:edit, :mode),
          # 画面で選べる方針（並べ方・線を触るか・大きさを変えるか）
          layout: params.dig(:edit, :layout),
          edges: params.dig(:edit, :edges),
          sizing: params.dig(:edit, :sizing),
          placement: params.dig(:edit, :placement)
        )
        Views::RevisionService.snapshot!(@view.reload, label: "AI調整の後")
        render json: serialize_view_detail(@view.reload).merge(
          ai_edit: {
            summary: result.summary,
            notes: result.notes,
            added: result.added,
            removed: result.removed,
            placed: result.placed,
            connected: result.connected
          }
        )
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue Views::AiEditService::EditError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue KeyError, Faraday::Error => e
        Rails.logger.warn "[ViewsController#ai_edit] failed view_id=#{@view.id}: #{e.class}: #{e.message}"
        render json: { error: "AI編集に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # POST /api/v1/views/:id/card_proposal
      # 「カードから作る」の第1段階。案を出すだけで、まだ作らない。
      # 作ると1枚1クレジット出ていくので、枚数を見てから決められるようにしている。
      def card_proposal
        result = Views::CardProposalService.call(
          view: @view,
          instruction: params.dig(:proposal, :instruction),
          count: params.dig(:proposal, :count),
          # create（新しく作る）/ select（手持ちから足す）
          source: params.dig(:proposal, :source) || "create"
        )

        render json: {
          proposals: result.proposals.map { |proposal| { title: proposal.title, reason: proposal.reason } },
          # 手持ちから図に組み込むもの。作らないのでクレジットは要らない
          reuse: result.reuse.map { |row| { id: row.id, title: row.title, reason: row.reason } },
          edges: result.edges.map { |edge| { from: edge.from, to: edge.to, label: edge.label } },
          plan: result.plan,
          # 上限で切ったかどうか。黙って減らすと図の抜けに気づけない
          truncated: result.truncated,
          max_count: Views::CardProposalService::MAX_COUNT,
          available_credits: current_user.available_credits
        }
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue Views::CardProposalService::ProposalError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue Faraday::Error => e
        Rails.logger.warn "[ViewsController#card_proposal] failed view_id=#{@view.id}: #{e.class}: #{e.message}"
        render json: { error: "提案を作れませんでした。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # POST /api/v1/views/:id/create_cards
      # 承認された案だけを実際に作り、このキャンバスに載せる。
      def create_cards
        titles = Array(params[:titles]).map { |title| title.to_s.strip }.reject(&:blank?).uniq
        reuse_ids = Array(params[:reuse_ids]).map(&:to_s).uniq
        # 手持ちを載せるだけ（新規作成なし）も正しい使い方なので、両方空のときだけ弾く
        if titles.empty? && reuse_ids.empty?
          return render json: { error: "作るカードを選んでください" }, status: :unprocessable_entity
        end
        if titles.size > Views::CardProposalService::MAX_COUNT
          return render json: { error: "一度に作れるのは #{Views::CardProposalService::MAX_COUNT} 枚までです" },
                        status: :unprocessable_entity
        end

        Views::RevisionService.snapshot!(@view, label: "カード追加の前")
        created = Views::CardCreationService.call(view: @view, titles: titles)
        # 手持ちから図に組み込むぶん。作らないのでクレジットは減らない
        reused = Views::CardCreationService.attach_existing!(view: @view, item_ids: reuse_ids)
        # 作っただけでは部品が積み上がっただけ。設計どおりに配置・線つなぎまで行う
        arranged = arrange_after_create(params[:instruction], params[:plan], params[:edges])
        Views::RevisionService.snapshot!(@view.reload, label: "カード追加の後")

        render json: serialize_view_detail(@view.reload).merge(
          created_cards: {
            count: created.size, titles: created.map(&:title),
            reused: reused.size, arranged: arranged
          }
        )
      rescue Items::CreateService::InsufficientCredits, Items::CreateService::ContentBlocked => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # 作ったカードを図として組み上げる。ここが失敗しても、カードは既に作られているので
      # 例外にはしない（作成そのものは成功しているため）。
      # 提案のときに決めた設計（完成図の説明・つながり）を配置へ引き継ぐ。
      # 指示文だけを渡し直すと、AI が設計を一から考え直して別の図になる
      def arrange_after_create(instruction, plan, edges)
        return false if instruction.blank?

        Views::AiEditService.call(
          view: @view.reload,
          instruction: [ instruction.to_s, design_note(plan, edges) ].compact.join("\n\n"),
          mode: "placed_only"
        )
        true
      rescue StandardError => e
        Rails.logger.warn "[ViewsController#create_cards] 配置に失敗 view_id=#{@view.id}: #{e.class}: #{e.message}"
        false
      end

      # 承認した設計を、配置の指示に添える形にする
      def design_note(plan, edges)
        lines = []
        lines << "完成図の設計: #{plan}" if plan.present?

        pairs = Array(edges).filter_map do |edge|
          from = edge.is_a?(ActionController::Parameters) || edge.is_a?(Hash) ? edge[:from] || edge["from"] : nil
          to = edge.is_a?(ActionController::Parameters) || edge.is_a?(Hash) ? edge[:to] || edge["to"] : nil
          label = edge.is_a?(ActionController::Parameters) || edge.is_a?(Hash) ? edge[:label] || edge["label"] : nil
          next if from.blank? || to.blank?

          label.present? ? "#{from} → #{to}（#{label}）" : "#{from} → #{to}"
        end
        lines << "つなぐ組み合わせ:\n#{pairs.join("\n")}" if pairs.any?

        lines.presence&.join("\n")
      end

      # POST /api/v1/views/:id/undo, /redo
      # AI 調整などの前後を行き来する。
      def undo
        render json: serialize_view_detail_with_revision(Views::RevisionService.undo!(@view))
      end

      def redo
        render json: serialize_view_detail_with_revision(Views::RevisionService.redo!(@view))
      end

      # DELETE /api/v1/views/:id/cover_image
      def remove_cover
        @view.cover_image.purge if @view.cover_image.attached?
        @view.cover_thumb.purge if @view.cover_thumb.attached?
        @view.update!(cover_type: "first_card")
        render json: serialize_view(@view)
      end

      # POST /api/v1/views/:id/background_image （multipart: background_image）
      def upload_background
        file = params[:background_image]
        return render(json: { errors: [ "画像が指定されていません" ] }, status: :unprocessable_entity) if file.blank?

        attach_optimized_image!(@view.background_image, file)
        render json: serialize_view(@view)
      rescue CoverImageUpload::InvalidCover => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # DELETE /api/v1/views/:id/background_image
      def remove_background
        @view.background_image.purge if @view.background_image.attached?
        render json: serialize_view(@view)
      end

      # space_map: ポイントからカードを外す
      def clear_point
        @view.view_items.find_by(space_point_id: params[:space_point_id])&.destroy!
        head :no_content
      end

      private

      # 名前での絞り込み。全件読み込まずに目当てのものへ辿り着けるようにする
      def filter_by_name(scope)
        query = params[:q].to_s.strip
        return scope if query.blank?

        scope.where("name ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(query)}%")
      end

      def set_view
        # 詳細でも serialize_view が cover_cards（view_items）を走査するため preload する
        @view = current_user.views.includes(
          view_items: { item: MEDIA_INCLUDES },
          cover_item: MEDIA_INCLUDES
        ).find(params[:id])
      end

      # 配置先ポイントがこのキャンバスのスペースに属することを保証する
      def view_space_point!
        raise ActiveRecord::RecordNotFound unless @view.space
        @view.space.space_points.find(params[:space_point_id])
      end

      def view_params
        params.require(:view).permit(:name, :view_type, :space_id)
      end

      def view_update_params
        params.require(:view).permit(
          :name, :cover_item_id, :cover_type,
          settings: [ :bg_color, :bg_pattern, :pattern_color, :card_font_size, :minimap, :controls ]
        )
      end

      # 表紙はキャンバスに配置したカードのみ指定可能
      def validate_cover!
        return if @view.cover_item_id.blank?
        return if @view.view_items.exists?(item_id: @view.cover_item_id)

        @view.errors.add(:cover_item_id, "はこのキャンバスに配置したカードを指定してください")
        raise ActiveRecord::RecordInvalid, @view
      end

      def placement_params
        params.permit(:x, :y, :z_index, :width, :height)
      end

      # deck の末尾 position（最大 + 1）
      def next_deck_position
        (@view.view_items.maximum(:position) || 0) + 1
      end

      def serialize_view(view)
        {
          id: view.id,
          name: view.name,
          view_type: view.view_type,
          space_id: view.space_id,
          cover_type: view.cover_type,
          cover_generation_status: view.cover_generation_status,
          cover_generation_error: view.cover_generation_error,
          cover_item_id: view.cover_item_id,
          cover: serialize_media(view.cover&.primary_media),
          cover_images: view.cover_cards.map { |item| serialize_media(item.primary_media) }.compact,
          cover_image: serialize_attached_cover(view),
          settings: view.settings,
          background_image: serialize_attached_background(view),
          created_at: view.created_at
        }
      end

      def serialize_view_detail_with_revision(revision_status)
        serialize_view_detail(@view.reload).merge(revision: revision_status)
      end

      def serialize_view_detail(view)
        return serialize_space_map_detail(view) if view.space_map?

        # deck は position 順、freeboard は重なり順
        order = view.deck? ? Arel.sql("position ASC NULLS LAST, created_at ASC") : Arel.sql("z_index, created_at")
        # デッキは一覧と同じ札で見せられるようにするので、札に要るものまで引く。
        # **枚数ぶん問い合わせを増やさない**ため、ここでまとめて読む
        associations = view.deck? ? [ :item_type, :meanings, :tags, { item_properties: :property_definition }, MEDIA_INCLUDES ]
                                  : [ :item_type, MEDIA_INCLUDES ]
        placements = view.view_items
                         .includes(item: associations)
                         .order(order)
        base = serialize_view(view)
               .merge(items: placements.map { |vi| serialize_placement(vi, list_card: view.deck?) })
               .merge(revision: Views::RevisionService.status(view))
        # 並べ方の設定は**キャンバスに1回だけ**付ける（全カードで同じもの）
        base = base.merge(card_list: card_list_meta) if view.deck?
        # freeboard のみ接続線を返す（deck は順序のみ）。重なり順（z_index）昇順で返す。
        base = base.merge(edges: view.view_edges.order(:z_index, :created_at).map { |edge| serialize_edge(edge) }) if view.freeboard?
        base
      end

      # space_map: スペースのポイント一覧（序数＋名前＋ポイント画像）と、各ポイントへの配置カードを返す
      def serialize_space_map_detail(view)
        base = serialize_view(view)
        space = view.space
        return base.merge(space: nil, points: []) unless space

        points = space.space_points.ordered
                      .includes(image_attachment: :blob, item: MEDIA_INCLUDES)
        placed = view.view_items
                     .where.not(space_point_id: nil)
                     .includes(item: [ :item_type, MEDIA_INCLUDES ])
                     .index_by(&:space_point_id)

        base.merge(
          space: { id: space.id, name: space.name, space_type: space.space_type },
          points: points.map { |point| serialize_point_placement(point, placed[point.id]) }
        )
      end

      # ポイントの loci 情報 + そのポイントに配置されたカード
      def serialize_point_placement(point, view_item)
        # 一体化: ビューの配置カードが無くても、点に設定したカード（point.item）を配置カードとして返す
        # （スペース詳細でカードを設定した点が space_map で「未配置」に見えないようにする）。
        placed = view_item&.item || point.item
        {
          space_point_id: point.id,
          position: point.position,
          name: point.name,
          generation_status: point.generation_status,
          image: point_loci_image(point),
          placed_item: placed ? serialize_item(placed) : nil
        }
      end

      # ロキ背景画像: 生成画像が無ければ、点に設定されたカードの画像を使う。
      def point_loci_image(point)
        serialize_point_image(point) ||
          (point.item ? serialize_media(point.item.primary_media)&.slice(:url, :thumb_url, :blur) : nil)
      end

      # list_card を立てると、カードは**一覧と同じ札の形**で返る。
      # デッキだけがそれを要る（板や空間は絵と名前しか出さない）
      def serialize_placement(view_item, list_card: false)
        {
          item_id: view_item.item_id,
          x: view_item.x,
          y: view_item.y,
          z_index: view_item.z_index,
          width: view_item.width,
          height: view_item.height,
          position: view_item.position,
          item: list_card ? serialize_list_item(view_item.item) : serialize_item(view_item.item)
        }
      end

      def serialize_attached_background(view)
        attachment = view.background_image
        return nil unless attachment.attached?
        return nil unless blob_available?(attachment.blob)

        { url: media_url(attachment.blob) }
      end

      def serialize_edge(edge)
        {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          source_handle: edge.source_handle,
          target_handle: edge.target_handle,
          label: edge.label,
          style: edge.style,
          points: edge.points,
          z_index: edge.z_index
        }
      end
    end
  end
end
