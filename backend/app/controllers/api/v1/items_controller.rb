module Api
  module V1
    class ItemsController < BaseController
      include ItemSerialization

      before_action :set_item,
                    only: [ :show, :update, :destroy, :retry, :approve_image, :meaning, :examples, :brief, :scene_rewrite,
                            :generate_tags, :fact_check, :fill_properties, :usages, :update_block_view ]

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
                            { medias: { file_attachment: :blob } })
                  .limit(per)
                  .offset((page - 1) * per)

        render json: {
          items: items.map { |i| serialize_item(repair_item_if_media_missing(i)) },
          meta: {
            page: page,
            per: per,
            total_count: total_count,
            total_pages: total_pages
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
        # 情景プロンプトはそのまま画像生成 API に渡るユーザー入力なので、保存前に検査する
        moderate_instruction!(item_update_params[:scene_prompt]) if brief_edited

        Item.transaction do
          item.update!(item_update_params)
          mark_brief_edited! if brief_edited
          upsert_meaning!
          assign_tags!(item)
          clear_fact_check!(item.primary_meaning) if title_changed
        end
        render json: serialize_item(item.reload)
      rescue Items::CreateService::ContentBlocked => e
        render json: { error: e.message }, status: :unprocessable_entity
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
        result = Images::SceneRewriteService.call(item: item, user: current_user)
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
          "omitted" => block_keys(:omitted)
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
      rescue Items::CreateService::ContentBlocked => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
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
        Arel.sql("#{column} #{direction}, items.created_at DESC")
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
          :generate_meaning, :generate_meaning_level, :generate_tags, :prompt_source
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

        moderate_instruction!(instructions[:custom_prompt])
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

      # 画面から来たキーを整える。長さも件数も抑えて、metadata が肥らないようにする
      def block_keys(name)
        Array(params[name]).map { |k| k.to_s.strip.first(Item::MAX_BLOCK_KEY_LENGTH) }
                           .reject(&:blank?).uniq.first(Item::MAX_BLOCK_KEYS)
      end

      def moderate_instruction!(text)
        return if text.blank?

        result = Moderation::PromptModerator.call(text)
        return if result.allowed?

        Rails.logger.warn(
          "[Moderation] BLOCKED user_id=#{current_user.id} category=#{result.category} term=#{result.term}"
        )
        raise Items::CreateService::ContentBlocked,
              "入力に利用できない表現が含まれているため再生成できませんでした。別の表現でお試しください。"
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

      def serialize_item(item)
        {
          id: item.id,
          title: item.title,
          # 一覧で名前として出す文字列。設定した項目に値があればそれ、無ければ見出し語。
          # どの項目かは利用者ごとの設定で決まる（別名で覚えている人がいるため）
          headline: headline_for(item),
          # 一覧のカードに、名前と絵のほかに出す項目。解決はサーバー側で行う
          # （一覧の payload に全項目を積むと重い。見出し語と同じ理由）
          list_fields: list_fields_for(item),
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
          meanings: item.meanings.ordered.map { |m| serialize_meaning_entry(m) },
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
            description: definition.description,
            value: values[definition.id]&.typed_value || (definition.list? ? [] : nil)
          }
        end
      end

      # 種別ごとの項目定義。一覧では1枚ごとに引くと枚数ぶん問い合わせが飛ぶので、
      # 1リクエストに1回だけ読んで種別で分けておく
      def definitions_for(item_type_id)
        @definitions_by_item_type ||= current_user.property_definitions.ordered.group_by(&:item_type_id)
        @definitions_by_item_type[item_type_id] || []
      end

      # 設定で選ばれた項目。空なら見出し語をそのまま使う
      def headline_key
        return @headline_key if defined?(@headline_key)

        @headline_key = current_user.setting&.card_headline_key.presence
      end

      # このカードの見え方。まだ一度も触っていないカードには、既定のひな型を当てる。
      #
      # ひな型に無いものを「持たない」に回すのはサーバー側では決められない
      # （どんなブロックがあるかを知っているのは画面側）。from_preset を立てて、
      # 残りを − に回す判断は画面に任せる。
      def block_view_for(item)
        base = {
          hidden: item.hidden_block_keys,
          order: item.ordered_block_keys,
          omitted: item.omitted_block_keys
        }
        return base.merge(from_preset: false) if base.values.any?(&:present?)

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

      # 一覧に出す名前。選ばれた項目が空のカードは見出し語に戻る
      # （名前の無いカードが並ぶより、元の名前が出ているほうがよい）
      def headline_for(item)
        return item.title if headline_key.blank?

        entry = item.item_properties.find { |p| p.property_definition&.key == headline_key }
        value = entry&.typed_value
        value = value.first if value.is_a?(Array)
        value.to_s.presence || item.title
      end

      # 意味・説明の1件ぶん。MeaningsController の返す形と揃える
      def serialize_meaning_entry(record)
        {
          id: record.id,
          definition: record.definition,
          example_sentence: record.example_sentence,
          detail_level: record.detail_level,
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
                                      { medias: { file_attachment: :blob } })
                            .find(params[:id])
      end

      attr_reader :item
    end
  end
end
