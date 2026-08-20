module Api
  module V1
    class ItemsController < BaseController
      include ItemSerialization
      include PromptModeration

      # 絵を1枚作る操作。体験用では登録への誘いに置き換える。
      # **見る・直す・並べるは通す**（そちらが体験の中身なので）
      before_action -> { deny_for_demo!(:generate_image) }, only: [ :create, :retry ]

      before_action :set_item,
                    only: [ :show, :update, :destroy, :retry, :approve_image, :meaning, :examples, :brief, :scene_rewrite,
                            :generate_tags, :fact_check, :fill_properties, :usages, :update_block_view,
                            :suggest_properties ]

      DEFAULT_PER_PAGE = 24
      MAX_PER_PAGE = 100
      # 並び替えのホワイトリスト（ユーザー入力を直接 ORDER BY に渡さない）
      SORTABLE_COLUMNS = { "created_at" => "items.created_at", "title" => "items.title" }.freeze
      SORT_DIRECTIONS = %w[asc desc].freeze

      def index
        scope = current_user.items
        if params[:status] == "needs_correction"
          # ファクトチェックで「正しい」以外＝訂正待ち（サブクエリで重複を避ける）
          flagged_ids = current_user.items.joins(:meanings)
                                    .where(meanings: { fact_check_status: %w[incorrect doubtful] }).select(:id)
          scope = scope.where(id: flagged_ids)
        elsif Item::GENERATION_STATUSES.include?(params[:status])
          scope = scope.where(generation_status: params[:status])
        end
        # 種別（単語・概念など）で絞る。**複数を許す**（「単語 と 概念」を並べて見たい）。
        # 空文字は「指定なし」として無視する（画面のプルダウンが初期値で送ってくる）
        types = Array(params[:item_type_ids]).map(&:to_s).reject(&:blank?)
        scope = scope.where(item_type_id: types) if types.any?
        scope = filter_by_tags(scope)
        if params[:q].present?
          like = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].strip)}%"
          scope = scope.where("items.title ILIKE ?", like)
        end
        scope = scope.order(sort_clause)

        per = pagination_per
        page = pagination_page
        total_count = scope.count
        total_pages = total_count.zero? ? 0 : (total_count.to_f / per).ceil

        items = scope
                  .includes(:item_type, :meanings, :tags,
                            { item_properties: :property_definition },
                            MEDIA_INCLUDES)
                  .limit(per)
                  .offset((page - 1) * per)

        render json: {
          items: items.map { |i| serialize_list_item(repair_item_if_media_missing(i)) },
          meta: {
            page: page,
            per: per,
            total_count: total_count,
            total_pages: total_pages,
            card_list: card_list_meta
          }
        }
      end

      # 一度に指定できるタグの数。増やしても絞り込みは細くなる一方で、
      # 組み合わせの数だけ「0件」に近づく。打ち止めを置いて重い問い合わせを防ぐ
      MAX_TAG_FILTERS = 10

      SUGGEST_LIMIT = 8

      # 検索オートコンプリート用の軽量サジェスト（タイトルのみ）
      def suggest
        q = params[:q].to_s.strip
        return render(json: { suggestions: [] }) if q.blank?

        like = "%#{ActiveRecord::Base.sanitize_sql_like(q)}%"
        items = current_user.items
                            .where("items.title ILIKE ?", like)
                            .order(created_at: :desc)
                            .limit(SUGGEST_LIMIT)

        render json: { suggestions: items.map { |i| { id: i.id, title: i.title } } }
      end

      # ダッシュボードの件数。
      #
      # 「あと何枚つくれるか」はクレジット残高（/billing/summary）が持つ。
      # ここが返していた monthly_limit / monthly_remaining は、クレジット制へ移る前の
      # 固定上限の名残で、実態と合わない数字を返していたため外した。
      #
      # 状態別の件数は1回の GROUP BY で数える（DB が遠く、往復が効くため）
      def summary
        by_status = current_user.items.group(:generation_status).count

        render json: {
          total_count: by_status.values.sum,
          pending_count: by_status["pending"].to_i,
          processing_count: by_status["processing"].to_i,
          failed_count: by_status["failed"].to_i,
          boxes_count: current_user.boxes.count,
          views_count: current_user.views.count,
          spaces_count: current_user.spaces.count,
          # 当月の実績（上限ではない）。カードと名前付きスペースポイントの合算
          monthly_count: current_user.monthly_generation_count
        }
      end

      # 詳細画面の前後ナビゲーション用。画像・意味・タグを含めず ID だけ返す。
      def navigation
        ids = current_user.items.order(sort_clause).pluck(:id)
        render json: { ids: ids }
      end

      def create
        result = Items::CreateService.call(user: current_user, params: item_params)
        assign_tags!(result.item)
        render json: serialize_item(result.item.reload), status: :accepted
      rescue Items::CreateService::InsufficientCredits => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue Items::CreateService::ContentBlocked => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def show
        render json: serialize_item(repair_item_if_media_missing(item))
      end

      # タイトル・種別・意味の編集。画像の再生成は伴わず、既存メディアと生成ステータスは保持する
      def update
        # 単語名を変えたら、説明への以前のファクトチェック判定は無効化する
        title_changed = item_update_params.key?(:title) && item_update_params[:title].to_s != item.title
        brief_edited = brief_edited_in_update?
        # 単語も説明も情景も、そのまま OpenAI へ渡るユーザー入力。保存前に検査する
        moderate_update_params!

        Item.transaction do
          item.update!(item_update_params)
          mark_brief_edited! if brief_edited
          upsert_meaning!
          assign_tags!(item)
          clear_fact_check!(item.primary_meaning) if title_changed
        end
        render json: serialize_item(item.reload)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # 説明文・画像への指示を単語から作り直す（同期）。
      #
      # preview=true のときは保存しない。作り直しパネルから呼ばれる用で、
      # 返した文は入力欄に入るだけ。手で書いた指示が、押した瞬間に消えないようにする。
      # （保存されるのは利用者が「この内容で作り直す」まで進んだときだけ）
      def brief
        unless Images::BriefResolver.enabled?
          return render json: { error: "この機能は現在無効になっています" }, status: :service_unavailable
        end

        result = Images::BriefResolver.call(title: item.title, user: current_user)
        return render json: { error: "画像への指示を作成できませんでした" }, status: :unprocessable_entity if result.nil?

        if ActiveModel::Type::Boolean.new.cast(params[:preview])
          return render json: { image_description: result.description, scene_prompt: result.scene_prompt }, status: :ok
        end

        item.update!(
          image_description: result.description,
          scene_prompt: result.scene_prompt,
          brief_status: "completed",
          brief_edited_at: nil
        )
        render json: serialize_item(item.reload), status: :ok
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue Images::BriefService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#brief] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "画像への指示の作成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # 意味・説明をもとに画像への指示を書き直す（同期）。「作り直す」パネルの
      # 「意味・説明から書き直す」から呼ばれる。
      #
      # ここでは保存しない。返した文は入力欄に入るだけで、利用者が読んで
      # 納得してから「この内容で作り直す」に進む。クレジットを使う前に
      # 何が変わるのかを目で確かめられるようにするため。
      #
      # 意味・ジャンルが分かれる語では候補が複数返る。どれを選ぶかは利用者が決める。
      def scene_rewrite
        result = Images::SceneRewriteService.call(
          item: item, user: current_user, property_keys: params[:property_keys]
        )
        render json: {
          options: result.options.map { |o| { label: o.label, scene_prompt: o.scene_prompt } },
          # 何を根拠に書き直したか。画面はこれを説明文として保存し、
          # 「プロンプト情報」の説明文と情景を同じ出どころに揃える
          description: result.description
        }, status: :ok
      rescue Images::SceneRewriteService::RewriteError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#scene_rewrite] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "書き直しに失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # カード1枚ごとの見え方（どのブロックを出すか・並び順）。
      #
      # 種別の設定（どの項目を持つか）とは効く範囲が違う。あちらは種別ぜんぶ、
      # こちらはこの1枚だけ。同じ画面で混ぜると、どこまで効くのか分からなくなる。
      def update_block_view
        item.update!(block_view: {
          "hidden" => block_keys(:hidden),
          "order" => block_keys(:order),
          # そのカードでは持たない項目。畳んでいる（hidden）のとは意味が違う
          "omitted" => block_keys(:omitted),
          # 札ごとの幅（何列ぶん）。1〜3の外は受けない。
          #
          # **送られてこなかったときは、いまの幅を残す。** 並べ替えは
          # hidden / order / omitted しか送らないので、ここで毎回上書きすると
          # 「動かしたら幅が戻った」という、原因の分かりにくい壊れ方をする
          "spans" => params.key?(:spans) ? block_spans_param : item.block_spans,
          # 列への振り分けを自分で決めるか、列ごとの個数はいくつか。
          # spans と同じで、**送られてこなかったときは、いまの値を残す**
          "auto_flow" => params.key?(:auto_flow) ? ActiveModel::Type::Boolean.new.cast(params[:auto_flow]) : item.block_auto_flow?,
          "column_counts" => params.key?(:column_counts) ? block_column_counts_param : item.block_column_counts
        })
        render json: serialize_item(item.reload)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # このカードがどこで使われているか（キャンバス・スペース・ボックス）。
      #
      # プロパティとして持たせない。配置は view_items / space_points / box_items が
      # 既に持っていて、そちらが正。カード側にも書くと必ず食い違う。
      # 見たいときに逆引きするだけにする。
      def usages
        render json: {
          views: item.views.distinct.map { |v| { id: v.id, name: v.name, view_type: v.view_type } },
          spaces: item.space_points.includes(:space).filter_map(&:space).uniq
                      .map { |s| { id: s.id, name: s.name } },
          boxes: item.boxes.distinct.map { |b| { id: b.id, name: b.name } }
        }
      end

      # 項目を AI でまとめて埋める（同期）。
      #
      # 項目ごとに呼ばず、1回の問い合わせで全項目を埋める。項目を10個定義した人が
      # 1枚のカードで10回 AI を叩くことになると、費用も待ち時間も項目数に比例する。
      #
      # 既定は空いている項目だけ。手で書いたものを黙って上書きしない。
      def fill_properties
        result = Items::FillPropertiesService.call(
          item: item,
          user: current_user,
          overwrite: ActiveModel::Type::Boolean.new.cast(params[:overwrite]) || false,
          # 項目を名指しすると、その項目だけを書く（1項目を書き直したいとき）
          keys: params[:keys].presence
        )
        render json: {
          filled_keys: result.filled_keys,
          skipped_keys: result.skipped_keys,
          item: serialize_item(item.reload)
        }, status: :ok
      rescue Items::FillPropertiesService::FillError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#fill_properties] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "項目を埋められませんでした。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      def destroy
        item.destroy!
        head :no_content
      end

      # 一括削除。current_user のカードのみ対象（他人のカードは無視）。
      # destroy_all で各レコードのコールバックを走らせ、画像（ActiveStorage）も片付ける。
      BULK_DESTROY_LIMIT = 200

      def bulk_destroy
        ids = Array(params[:ids]).map { |id| id.to_s.strip }.reject(&:blank?).uniq.first(BULK_DESTROY_LIMIT)
        return render(json: { deleted_ids: [] }, status: :ok) if ids.empty?

        deleted = current_user.items.where(id: ids).destroy_all
        render json: { deleted_ids: deleted.map(&:id) }, status: :ok
      end

      # 再生成。failed だけでなく completed（生成成功済み）からも再生成できる。
      # 任意で custom_prompt / style の指示を受け取り、曖昧な入力の補足やニュアンス調整に使う。
      def retry
        current_item = repair_item_if_media_missing(item)
        unless %w[failed completed].include?(current_item.generation_status)
          return render json: { error: "生成が完了または失敗したカードのみ再生成できます" }, status: :unprocessable_entity
        end

        was_completed = current_item.generation_status == "completed"
        instructions = regeneration_instructions
        use_meaning = regeneration_use_meaning?
        apply_regeneration_instructions!(current_item, instructions)

        # 語や指示が変われば、それは別の絵の注文。失敗の種類による縛りも回数の勘定も引き継がない。
        # 判定は「指示が渡されたか」ではなく、**実際に注文する文字列が変わったか**で行う
        # （画面は指示欄が空でも custom_prompt: "" を送り、単語や情景は別の口から変わるため）
        changed_input = ::Images::RetryPolicy.input_changed?(current_item, include_meaning: use_meaning)

        # 失敗からの作り直しは、押して直るものか・何度目かを見てから通す。
        # 無料であることと、何度でも押せることは別（Images::RetryPolicy に理由を置いた）
        decision = ::Images::RetryPolicy.decide(target: current_item, changed_input: changed_input)
        unless was_completed || decision.allowed?
          return render json: { error: decision.reason }, status: :unprocessable_entity
        end

        # 出来上がったものを作り直すときはクレジットを使う。新しい画像を1枚作るので、
        # 原価は初回とまったく同じ。失敗からの作り直しは、無料の回数を使い切るまでは無料。
        charge_for_regeneration!(current_item) if was_completed || decision.charge?
        unless was_completed
          ::Images::RetryPolicy.count_free_retry!(current_item, reset: changed_input || decision.charge?)
        end

        # completed の作り直しは、同じ絵を返しても意味が無いのでキャッシュを使わない。
        # 失敗からの作り直しは使う。注文が同じなら、既にある絵で足りる（呼ばずに済む）
        force = was_completed
        current_item.update_generation_status!("pending")
        enqueue_generation(current_item, force_generate: force, use_meaning: use_meaning)
        render json: serialize_item(current_item.reload), status: :accepted
      rescue User::InsufficientCredits
        render json: { error: "クレジットが不足しています" }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # このカードに持たせるとよい項目を AI に選ばせる。
      #
      # 選ぶだけで、保存はしない。当てるかどうかは画面（「表示」）が決める。
      # ここで保存すると、押した瞬間に並びが変わって元に戻せなくなる。
      def suggest_properties
        result = Cards::SuggestPropertiesService.call(
          item: item, available_keys: params[:available_keys], user: current_user
        )
        render json: { keys: result.keys }, status: :ok
      rescue Cards::SuggestPropertiesService::SuggestError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#suggest_properties] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "選べませんでした。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # 例文を AI で書く。説明はそのままで、例文だけ書き直せるようにする。
      #
      # overwrite=false（既定）なら例文の無いものだけ。meaning_id を渡すとその1件だけ。
      def examples
        result = Items::GenerateExamplesService.call(
          item: item,
          overwrite: ActiveModel::Type::Boolean.new.cast(params[:overwrite]) || false,
          meaning_id: params[:meaning_id].presence
        )
        render json: { written_ids: result.written_ids, item: serialize_item(item.reload) }, status: :ok
      rescue Items::GenerateExamplesService::GenerationError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue Faraday::Error => e
        Rails.logger.warn "[ItemsController#examples] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "例文を書けませんでした。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # セーフガードの承認。覆いを外して、普通に見られる状態にする。
      #
      # 「これでよい」と決めるのは利用者なので、承認は取り消せる必要が無い
      # （気に入らなければ作り直すか、カードごと消す）。
      def approve_image
        media = item.primary_media
        return render json: { error: "画像がありません" }, status: :unprocessable_entity if media.blank?

        media.update!(needs_approval: false)
        render json: serialize_item(item.reload), status: :ok
      end

      # 意味・説明を AI で生成（同期）。詳細画面の「意味を生成」ボタンや一括操作から呼ばれる。
      # level（brief / simple / detailed）で詳しさを選べる。未指定は simple。
      # only_if_empty=true なら、既に説明があるカードはスキップする（未設定の穴埋め用）。
      def meaning
        if truthy?(params[:only_if_empty]) && item.primary_meaning.present?
          return render json: { status: "skipped", reason: "already_has_meaning" }, status: :ok
        end

        GenerateMeaningService.call(item: item, level: params[:level])
        render json: serialize_item(item.reload), status: :ok
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue GenerateMeaningService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#meaning] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "意味の生成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # タグを AI で生成（同期）。詳細画面の「AIで生成」ボタンや一括操作から呼ばれる。
      # replace=true: AI結果で置き換え。false（既定）: 既存タグへ union で追加。
      # only_if_empty=true: 既にタグがあるカードはスキップ（未設定の穴埋め用）。
      def generate_tags
        if truthy?(params[:only_if_empty]) && item.tags.exists?
          return render json: { status: "skipped", reason: "already_tagged" }, status: :ok
        end

        GenerateTagsService.call(item: item, replace: truthy?(params[:replace]))
        render json: serialize_item(item.reload), status: :ok
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue GenerateTagsService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#generate_tags] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "タグの生成に失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      # カードの説明（meaning）が事実として正しいかを AI でファクトチェックする（同期）。
      # 説明が無いカードはスキップを返す。
      def fact_check
        result = GenerateFactCheckService.call(item: item)
        return render json: { status: "skipped", reason: "no_meaning" }, status: :ok if result.nil?

        render json: serialize_item(item.reload), status: :ok
      rescue Ai::Chat::LimitExceeded => e
        render json: { error: e.message }, status: :too_many_requests
      rescue GenerateFactCheckService::GenerationError, KeyError, Faraday::Error => e
        Rails.logger.warn "[ItemsController#fact_check] failed item_id=#{item.id}: #{e.class}: #{e.message}"
        render json: { error: "AIチェックに失敗しました。時間を置いて再度お試しください。" }, status: :unprocessable_entity
      end

      private

      # クエリ/フォームの真偽値（"true"/"1" 等）を bool に変換する
      def truthy?(value)
        ActiveModel::Type::Boolean.new.cast(value)
      end

      # 並び替え句を組み立てる。カラム・方向は許可リストからのみ採用し、安定化のため created_at を副キーにする
      # タグでの絞り込み。複数を指定したら**すべてを持つもの**だけを残す。
      #
      # 「絞り込み」なので、増やすほど狭くなるのが読みどおり（どれかを持つ、だと逆に広がる）。
      # 外側の scope に group を掛けると件数の数え方まで変わるので、
      # 当てはまる id を副問い合わせで出して where で当てる
      def filter_by_tags(scope)
        ids = Array(params[:tag_ids]).presence || Array(params[:tag_id]).presence
        ids = ids.to_a.map(&:to_s).reject(&:blank?).uniq.first(MAX_TAG_FILTERS) if ids
        return scope if ids.blank?

        matching = current_user.items.joins(:item_tags).where(item_tags: { tag_id: ids })
                               .group("items.id")
                               .having("COUNT(DISTINCT item_tags.tag_id) = ?", ids.size)
                               .select("items.id")
        scope.where(id: matching)
      end

      def sort_clause
        column = SORTABLE_COLUMNS.fetch(params[:sort], "items.created_at")
        direction = SORT_DIRECTIONS.include?(params[:direction]) ? params[:direction] : "desc"
        # 最後に id を置いて、同着の順を決め切る。
        # 同じ時刻・同じ名前のカードが並ぶと、LIMIT/OFFSET のページごとに順が変わり得て、
        # **同じカードが2ページに出て、別のカードがどこにも出ない**ことが起こる
        Arel.sql("#{column} #{direction}, items.created_at DESC, items.id DESC")
      end

      # 1始まり。不正値・0以下は 1 に丸める
      def pagination_page
        page = params[:page].to_i
        page < 1 ? 1 : page
      end

      # 1〜MAX_PER_PAGE にクランプ。未指定・不正値は DEFAULT_PER_PAGE
      def pagination_per
        per = params[:per].to_i
        return DEFAULT_PER_PAGE if per <= 0

        per.clamp(1, MAX_PER_PAGE)
      end

      def item_params
        params.require(:item).permit(
          :title, :item_type_id, :force_generate, :style, :custom_prompt, :framing, :aspect_ratio, :image_model,
          :detect_item_type,
          :generate_meaning, :generate_meaning_level, :generate_tags, :prompt_source,
          # 項目（読み仮名・別名など）の自動生成。識別名を渡すと、そのぶんだけ埋める
          :generate_properties, generate_property_keys: []
        )
      end

      # 再生成時の指示（custom_prompt / style / framing）。指定されたキーのみを返す。
      def regeneration_instructions
        item_param = params[:item]
        return {} unless item_param.respond_to?(:permit)

        # prompt_source は作成時の選択で、ここでは受け取らない。
        # 作り直し側には「単語から書き直す」「意味・説明から書き直す」があり、
        # 押した結果が入力欄に見える。黙って経路が変わるより、そちらのほうが分かる。
        item_param.permit(:custom_prompt, :style, :framing, :image_model)
                  .to_h.symbolize_keys.reject { |_, v| v.nil? }
      end

      # 再生成時に意味・説明を参考にするか（既定 false）。boolean 以外は false に丸める。
      def regeneration_use_meaning?
        ActiveModel::Type::Boolean.new.cast(params.dig(:item, :use_meaning)) || false
      end

      # 指示が渡された場合のみ、custom_prompt をモデレーションして item に反映する
      def apply_regeneration_instructions!(target, instructions)
        return if instructions.empty?

        moderate_prompt!(instructions[:custom_prompt], as: "custom_prompt")
        target.update!(instructions)
      end

      # 画像への指示がまだ無いカードは、再生成のついでに下ごしらえから作り直す。
      # 既にある（＝作成時に作られた／手で直した）ものは、そのまま画像生成へ進めて
      # 無駄な問い合わせを増やさない。
      #
      # 「単語をそのまま」で作ったカードは、作り直しでも下ごしらえを挟まない。
      # 挟むと、作り直しただけで別のやり方の絵に化けてしまう。
      def enqueue_generation(target, force_generate:, use_meaning:)
        needs_brief = target.effective_prompt_source != "word" &&
                      target.scene_prompt.blank? && !target.brief_edited?
        if needs_brief
          GenerateBriefJob.perform_later(target.id, force_generate: force_generate, use_meaning: use_meaning)
        else
          GenerateImageJob.perform_later(target.id, force_generate: force_generate, use_meaning: use_meaning)
        end
      end

      # 作り直しぶんのクレジットを、生成を積む前に消費する。
      # 積んでから足りないと分かると、画像だけ作られて課金できない状態になる。
      def charge_for_regeneration!(target)
        current_user.ensure_free_credits!
        cost = ::Billing::CreditCost.call(kind: :regeneration, model_key: target.image_model)

        current_user.with_lock do
          raise User::InsufficientCredits if current_user.available_credit_points < cost

          current_user.consume_credits!(cost, item: target)
        end
      end

      # 札ごとの幅。知らないキーや範囲外は落とす。
      # 1（既定）は書かない。全部の札を書き出すと、項目が増えるほど metadata が肥る
      BLOCK_SPAN_RANGE = (1..3).freeze

      def block_spans_param
        raw = params[:spans]
        return {} unless raw.respond_to?(:each_pair)

        raw.to_unsafe_h.each_with_object({}) do |(key, value), acc|
          span = value.to_i
          next unless BLOCK_SPAN_RANGE.include?(span) && span > 1

          acc[key.to_s.first(Item::MAX_BLOCK_KEY_LENGTH)] = span
        end.first(Item::MAX_BLOCK_KEYS).to_h
      end

      # 列ごとの個数。列は最大3なので、それ以上は受けない。
      # 1枚のカードが持てる札の数を超える値も意味が無いので抑える
      def block_column_counts_param
        Array(params[:column_counts]).first(BLOCK_SPAN_RANGE.max)
             .map { |n| n.to_i.clamp(0, Item::MAX_BLOCK_KEYS) }
      end

      # 画面から来たキーを整える。長さも件数も抑えて、metadata が肥らないようにする
      def block_keys(name)
        Array(params[name]).map { |k| k.to_s.strip.first(Item::MAX_BLOCK_KEY_LENGTH) }
                           .reject(&:blank?).uniq.first(Item::MAX_BLOCK_KEYS)
      end

      # 更新で検査する項目。**どれも最後は OpenAI へ届く。**
      #
      #   title             作り直しの注文そのもの（PromptBuilderService / BriefResolver）
      #   image_description 説明から情景を書き起こす入力
      #   scene_prompt      画像生成 API へ渡る文
      #
      # 以前は `scene_prompt` だけを見ていた。作成時に弾かれる語でも、
      # 素通しの語で作ってから `title` を書き換えれば通せてしまっていた。
      MODERATED_UPDATE_KEYS = %w[title image_description scene_prompt].freeze

      # **変わった値だけ**を見る。
      # 元から入っている値で弾くと、ブロックリストを足した日に
      # 既存カードが編集できなくなる（作り直しは別の口で止まる）。
      def moderate_update_params!
        MODERATED_UPDATE_KEYS.each do |key|
          next unless item_update_params.key?(key)

          value = item_update_params[key].to_s
          next if value == item.public_send(key).to_s

          moderate_prompt!(value, as: key)
        end
      end

      def item_update_params
        params.require(:item).permit(:title, :item_type_id, :image_description, :scene_prompt)
      end

      # 説明文・情景プロンプトを手で直したか。直したものは以後の自動生成で上書きしない
      BRIEF_EDITABLE_KEYS = %w[image_description scene_prompt].freeze

      def brief_edited_in_update?
        BRIEF_EDITABLE_KEYS.any? do |key|
          item_update_params.key?(key) && item_update_params[key].to_s != item.public_send(key).to_s
        end
      end

      # 手直しの記録。情景を空にしたら「無し」＝単語をそのまま使う状態に戻す
      def mark_brief_edited!
        item.update!(
          brief_edited_at: Time.current,
          brief_status: item.scene_prompt.present? ? "completed" : "none"
        )
      end

      # item[meaning] が渡された場合のみ日本語の意味を upsert する。
      # 空文字なら既存の意味を削除する（未指定キーは無視）
      def upsert_meaning!
        item_param = params[:item]
        return unless item_param.respond_to?(:key?) && item_param.key?(:meaning)

        definition = item_param[:meaning].to_s.strip
        meaning = item.meanings.find_or_initialize_by(language_code: "ja")

        if definition.blank?
          meaning.destroy! if meaning.persisted?
        else
          # 説明を書き換えたら、以前のファクトチェック結果は無効化する（古い判定が残らないように）
          meaning.clear_fact_check if meaning.definition != definition
          meaning.definition = definition
          meaning.save!
        end
      end

      # 既存（永続化済み）の meaning のファクトチェック結果をクリアする
      def clear_fact_check!(meaning)
        return unless meaning&.persisted?

        meaning.clear_fact_check
        meaning.save!
      end

      # item[tags] にタグ名配列が渡された場合のみ、その内容でタグを設定する（未指定なら変更しない）。
      # 存在しないタグ名は作成、外れたタグは関連解除する。
      def assign_tags!(target)
        names = params.dig(:item, :tags)
        return if names.nil?

        tags = Array(names).map { |n| n.to_s.strip }.reject(&:blank?).uniq(&:downcase).first(50).map do |name|
          current_user.tags.find_or_create_by!(name: name)
        end
        target.tags = tags
      end

      # 一覧に出す分だけ。詳細と同じ中身を返さない。
      #
      # 一覧が読むのはここにある12項目だけで、残り（項目の定義一式・意味の全件・
      # 画像への指示・ファクトチェックの根拠）は1枚も表示していない。
      # それでも積んでいたので、24枚で33KB を運んでいた。Wikipedia の項目が
      # 増えてからは、抜粋の長さがそのまま一覧の重さになっていた。
      #
      # カードを開いた先は `getItem()` で取り直すので、ここで削っても詳細は欠けない
      def serialize_list_item(item)
        {
          id: item.id,
          title: item.title,
          headline: headline_for(item),
          list_fields: card_list_fields_for(item),
          aspect_ratio: item.aspect_ratio,
          generation_status: item.generation_status,
          generation_error: item.generation_error,
          generation_retryable: item.generation_status != "failed" ||
            ::Images::RetryPolicy.retryable?(item),
          item_type: serialize_item_type(item.item_type),
          meaning: item.primary_meaning&.definition,
          # 一覧では警告色を出すかどうかだけに使う。根拠（claims 等）は詳細で読む
          fact_check_status: item.primary_meaning&.fact_check_status,
          fact_check_comment: item.primary_meaning&.fact_check_comment,
          fact_check_acknowledged_at: item.primary_meaning&.fact_check_acknowledged_at,
          tags: item.tags.map { |t| { id: t.id, name: t.name } },
          media: serialize_media(item.primary_media),
          created_at: item.created_at
        }
      end

      def serialize_item(item)
        {
          id: item.id,
          title: item.title,
          # 一覧で名前として出す文字列。設定した項目に値があればそれ、無ければ見出し語。
          # どの項目かは利用者ごとの設定で決まる（別名で覚えている人がいるため）
          headline: headline_for(item),
          # 一覧のカードに、名前と絵のほかに出す項目。解決はサーバー側で行う
          # （一覧の payload に全項目を積むと重い。見出し語と同じ理由）
          list_fields: card_list_fields_for(item),
          generation_status: item.generation_status,
          generation_error: item.generation_error,
          # 押して直る失敗かどうか。画面は、直らないものに「作り直す」を出さない
          generation_retryable: item.generation_status != "failed" ||
            ::Images::RetryPolicy.retryable?(item),
          item_type: serialize_item_type(item.item_type),
          # 代表の1件は据え置き（既にこれを読んでいる画面を後退させない）。
          # 複数を扱う画面は meanings のほうを見る
          meaning: item.primary_meaning&.definition,
          meaning_example: item.primary_meaning&.example_sentence,
          meaning_level: item.primary_meaning&.detail_level,
          fact_check_status: item.primary_meaning&.fact_check_status,
          fact_check_comment: item.primary_meaning&.fact_check_comment,
          fact_check_suggestion: item.primary_meaning&.fact_check_suggestion,
          fact_check_title_suggestion: item.primary_meaning&.fact_check_title_suggestion,
          fact_check_known: item.primary_meaning&.fact_check_known,
          fact_check_claims: item.primary_meaning&.fact_check_claims || [],
          fact_checked_at: item.primary_meaning&.fact_checked_at,
          fact_check_acknowledged_at: item.primary_meaning&.fact_check_acknowledged_at,
          meanings: item.sorted_meanings.map { |m| serialize_meaning_entry(m) },
          properties: serialize_properties(item),
          style: item.style,
          framing: item.framing,
          image_model: item.image_model,
          prompt_source: item.effective_prompt_source,
          block_view: block_view_for(item),
          custom_prompt: item.custom_prompt,
          image_description: item.image_description,
          scene_prompt: item.scene_prompt,
          brief_status: item.brief_status,
          brief_edited: item.brief_edited?,
          tags: item.tags.map { |t| { id: t.id, name: t.name } },
          media: serialize_media(item.primary_media),
          created_at: item.created_at
        }
      end

      # その種別で定義されている項目を、順番どおりに全部返す。
      # 値が入っていない項目も出す（画面で「まだ書いていない」と分かるように）。
      def serialize_properties(item)
        return [] if item.item_type_id.blank?

        values = item.item_properties.index_by(&:property_definition_id)
        definitions_for(item.item_type_id).map do |definition|
          {
            property_definition_id: definition.id,
            key: definition.key,
            label: definition.label,
            value_type: definition.value_type,
            # 何のために持つ項目か（見分けが付くよう、画面で色と見出しに使う）
            category: definition.category,
            description: definition.description,
            value: property_entry_value(definition, values[definition.id])
          }
        end
      end

      # 項目1件ぶんの値。
      # 自由イメージだけは、指し示している絵の URL を添える（画面はそれを出すだけでよい）
      def property_entry_value(definition, property)
        value = property&.typed_value
        return (definition.list? ? [] : nil) if value.nil?
        return value unless definition.value_type == "free_image"

        value.merge("url" => free_image_url(value["shared_media_id"])).compact
      end

      def free_image_url(shared_media_id)
        return nil if shared_media_id.blank?

        shared = shared_media_for(shared_media_id)
        return nil unless shared&.file&.attached?

        blob = shared.thumb.attached? ? shared.thumb.blob : shared.file.blob
        blob_available?(blob) ? media_url(blob) : nil
      end

      # 自由イメージが指している絵。**1リクエストにつき、同じ絵は1回しか引かない**。
      # 項目ごとに引くと、項目の数だけ問い合わせが飛ぶ（絵の実体も別に2本ずつ増える）
      def shared_media_for(id)
        @shared_media_cache ||= {}
        return @shared_media_cache[id] if @shared_media_cache.key?(id)

        @shared_media_cache[id] = SharedMedia.with_files.find_by(id: id)
      end

      # 種別ごとの項目定義。一覧では1枚ごとに引くと枚数ぶん問い合わせが飛ぶので、
      # 1リクエストに1回だけ読んで種別で分けておく
      def definitions_for(item_type_id)
        @definitions_by_item_type ||= current_user.property_definitions.ordered.group_by(&:item_type_id)
        @definitions_by_item_type[item_type_id] || []
      end

      # 名前として出す項目。**並びの先頭にある、名前になりうる項目**（Setting が決める）。
      # 何も選んでいなければ nil で、そのときは見出し語をそのまま使う
      def headline_key
        return @headline_key if defined?(@headline_key)

        @headline_key = current_user.setting&.headline_key
      end

      # このカードの見え方。まだ一度も触っていないカードには、既定のひな型を当てる。
      #
      # ひな型に無いものを「持たない」に回すのはサーバー側では決められない
      # （どんなブロックがあるかを知っているのは画面側）。from_preset を立てて、
      # 残りを − に回す判断は画面に任せる。
      def block_view_for(item)
        # 「このカードは自分で並べたか」の判断に使う4つ。
        # **auto_flow と column_counts はここに入れない。**
        # auto_flow は既定でも true が入っていて、常に present になるため、
        # 混ぜるとどのカードも「自分で並べた」と判定され、ひな型が当たらなくなる
        arranged = {
          hidden: item.hidden_block_keys,
          order: item.ordered_block_keys,
          omitted: item.omitted_block_keys,
          spans: item.block_spans
        }
        base = arranged.merge(
          auto_flow: item.block_auto_flow?,
          column_counts: item.block_column_counts
        )
        return base.merge(from_preset: false) if arranged.values.any?(&:present?)

        preset_keys = current_user.setting&.default_preset_keys
        return base.merge(from_preset: false) if preset_keys.blank?

        base.merge(order: preset_keys, from_preset: true)
      end

      # 一覧に出す追加項目。値の無いものは返さない（空の行が並ぶだけになる）
      def list_field_keys
        @list_field_keys ||= Array(current_user.setting&.card_list_fields)
      end

      def list_fields_for(item)
        return [] if list_field_keys.empty?

        list_field_keys.filter_map do |key|
          entry = item.item_properties.find { |p| p.property_definition&.key == key }
          value = entry&.typed_value
          value = value.join("、") if value.is_a?(Array)
          text = value.to_s.presence
          next if text.nil?

          { key: key, label: entry.property_definition.label, value: text }
        end
      end

      # 一覧に出す名前。
      #
      # **選ばれた項目が空でも見出し語へ戻さない。** 戻すと、設定した人には
      # 「効いていない」と映る（実際に効いているのに、値が無いだけ）。
      # 値が無いことは、値が無いと分かる形で見せる（画面が「-」を出す）。
      def headline_for(item)
        return item.title if headline_key.blank?

        # 名前は1つ。複数入る項目（別名など）を選んでいても、つないで長くしない
        property_value_for(item, headline_key, multiple: :first)
      end

      # 一覧の各カードに出す項目。**順序と表示の有無は設定が持つ**。
      #
      # 出す指定の項目は、値が無くても行ごと返す（value: nil）。
      # 返さないと、あるカードには出てあるカードには出ない、という
      # 法則の読めない並びになる。**出さない指定の項目は、そもそも返さない。**
      def card_list_fields_for(item)
        card_list_layout.filter_map do |row|
          key = row["key"].to_s
          next unless row["visible"]
          # 名前と絵は、カードの形そのものとして別に描かれる。
          # 名前として使っている項目も、下にもう一度出さない（同じ値が2つ並ぶ）
          next if key == "title" || key == "image" || key == headline_key

          if key == "meaning"
            { key: key, label: "意味・説明", value: meaning_summary_for(item) }
          else
            { key: key, label: property_labels[key] || key, value: property_value_for(item, key) }
          end
        end
      end

      # 一覧の並べ方。**カードごとではなく1回だけ返す**（全カードで同じ設定のため）。
      #
      # 画面は blocks の順にそのまま積む。これを渡していなかったころは、
      # 絵と項目の並びがカード側に固定で書かれていて、
      # **設定で「イメージ」を外しても絵が出続け、項目を並べ替えても順が変わらなかった。**
      def card_list_meta
        blocks = card_list_layout.filter_map do |row|
          key = row["key"].to_s
          next unless row["visible"]
          # 名前はカードの見出しとして別に描く。名前に使っている項目も下に重ねない
          next if key == "title" || key == headline_key

          key
        end

        { blocks: blocks, image: blocks.include?("image") }
      end

      # 設定の行がまだ無い人にも既定の並びを使う。
      # 空で返すと、一度も設定を触っていない人のカードから絵が消える
      def card_list_layout
        @card_list_layout ||=
          (current_user.setting&.card_list_layout_entries || ::Setting::DEFAULT_CARD_LIST_LAYOUT)
      end

      # 項目の呼び名。**カード側からは引かない。**
      # 値の無いカードには項目の行そのものが無く、そこから呼び名を取ると
      # 「値が無いときだけ識別名が出る」というちぐはぐな見え方になる。
      # 1回だけまとめて引く（件数に比例して増やさない）
      def property_labels
        @property_labels ||= PropertyDefinition.where(user: current_user).pluck(:key, :label).to_h
      end

      # 項目の値を文字にする。
      #
      # 複数入る項目の扱いは置き場所で変える。
      #   名前（headline）… 先頭だけ。つなぐと名前として長すぎる
      #   名前の下の項目  … 読点でつなぐ（既存の見せ方）
      def property_value_for(item, key, multiple: :join)
        entry = item.item_properties.find { |p| p.property_definition&.key == key }
        value = entry&.typed_value
        # チェックは true/false をそのまま文字にすると「true」と出る。
        # **触っていない状態と「切」を分けたまま**、読める形に直す
        return (value ? "入" : "切") if entry&.boolean? && !value.nil?
        # 中身が2つある項目（自由テキスト・自由イメージ）は、そのまま文字にすると
        # **`{"heading"=>…}` が一覧に出る**。読める形に組み直す
        return compound_summary(entry, value) if value.is_a?(Hash)

        value = multiple == :first ? value.first : value.join("、") if value.is_a?(Array)
        text = value.to_s.presence
        # Wikipedia は JSON の文字列で入っている。**そのまま出すと鍵と URL が一覧に並ぶ**
        entry&.property_definition&.value_type == "wikipedia" ? wikipedia_summary(text) : text
      end

      # Wikipedia の値から、一覧に出す1行を取り出す。題名が無ければ冒頭で代える
      def wikipedia_summary(raw)
        return raw if raw.blank?

        parsed = JSON.parse(raw)
        return raw unless parsed.is_a?(Hash)

        parsed["wikipedia_title"].presence || parsed["wikipedia_extract"].to_s.presence
      rescue JSON::ParserError
        raw
      end

      # 見出しと中身を持つ項目を、一覧の1行にする。
      # 自由イメージは絵そのものを文字にできないので、付けた見出し（無ければ指示）で表す
      def compound_summary(entry, value)
        heading = value["heading"].to_s.strip.presence
        body = (entry&.free_image? ? value["prompt"] : value["body"]).to_s.strip.presence
        return body if heading.nil?
        return heading if body.nil? || entry&.free_image?

        "#{heading}：#{body}"
      end

      # 意味・説明は一覧を圧迫するので、先頭のものだけを短く出す（画面側で3行に丸める）
      def meaning_summary_for(item)
        item.meanings.min_by(&:position)&.definition.presence
      end

      # 意味・説明の1件ぶん。MeaningsController の返す形と揃える
      def serialize_meaning_entry(record)
        {
          id: record.id,
          definition: record.definition,
          example_sentence: record.example_sentence,
          detail_level: record.detail_level,
          # 何を書いた文か（意味 / 説明 / 解説 / 翻訳 / 原義）
          kind: record.kind,
          language_code: record.language_code,
          position: record.position,
          fact_check_status: record.fact_check_status,
          fact_check_comment: record.fact_check_comment,
          fact_check_suggestion: record.fact_check_suggestion,
          fact_checked_at: record.fact_checked_at,
          fact_check_acknowledged_at: record.fact_check_acknowledged_at
        }
      end

      def serialize_item_type(item_type)
        return nil unless item_type

        { id: item_type.id, name: item_type.name, label: item_type.label }
      end

      # ItemSerialization#serialize_media に、生成メタ情報（ⓘ 用）を足す。
      #
      # 以前はキーを並べ直して丸ごと上書きしていたため、共通側に項目を足しても
      # ここには出てこなかった（実際に needs_approval を足したときに抜けた）。
      # 共通の結果に足すだけにして、二度と食い違わないようにする。
      def serialize_media(media)
        base = super
        return nil if base.nil?

        base.merge(generation_info: media_generation_info(media))
      end

      # 画像生成時のメタ情報を、ホワイトリストしたキーだけで返す（内部キーは出さない）。
      # 全て空なら nil（旧データ・キャッシュ由来でメタが無いカードは項目を出さない）。
      GENERATION_INFO_KEYS = %w[provider model quality size revised_prompt].freeze

      def media_generation_info(media)
        metadata = media.metadata
        return nil if metadata.blank?

        info = GENERATION_INFO_KEYS.each_with_object({}) do |key, acc|
          value = metadata[key]
          acc[key] = value if value.present?
        end
        info.presence
      end

      # media_url / thumbnail_url / blob_available? は ItemSerialization concern を再利用する
      # （CDN 直配信・local プロキシ対応。以前はこのクラスに重複定義していた）。

      MISSING_MEDIA_REPAIR_GRACE_PERIOD = 30.seconds

      def repair_item_if_media_missing(item)
        return item unless item.generation_status == "completed"

        media = item.primary_media
        return item if media&.file&.attached? && blob_available?(media.file.blob)
        return item if item.updated_at >= MISSING_MEDIA_REPAIR_GRACE_PERIOD.ago

        item.mark_generation_failed!(
          message: "画像ファイルが見つからなかったため、再生成が必要です。",
          code: "missing_media"
        )
        item.reload
      end

      def set_item
        @item = current_user.items
                            .includes(:item_type, :meanings, :tags,
                                      { item_properties: :property_definition },
                                      MEDIA_INCLUDES)
                            .find(params[:id])
      end

      attr_reader :item
    end
  end
end
