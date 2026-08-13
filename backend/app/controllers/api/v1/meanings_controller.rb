module Api
  module V1
    # カード1枚に複数の意味・説明を持たせるための出入口。
    #
    # これまで器（has_many）はあったのに、画面には代表の1件しか出ていなかった。
    # 多義語・分野で意味が変わる語・言語ごとの訳は、1件では書き切れない。
    #
    # 代表は既存の Item#primary_meaning のまま（日本語優先 → position 先頭）で、
    # そこは変えない。既に代表を読んでいる画面を後退させないため。
    class MeaningsController < BaseController
      before_action :set_item
      before_action :set_meaning, only: [ :update, :destroy, :acknowledge ]

      MAX_PER_ITEM = 20

      def create
        if item.meanings.count >= MAX_PER_ITEM
          return render json: { error: "意味・説明は#{MAX_PER_ITEM}件までです" }, status: :unprocessable_entity
        end

        meaning = item.meanings.create!(create_params)
        render json: serialize_meaning(meaning), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        # 説明そのものが変わったら、以前のファクトチェック判定は当てにならない
        meaning.clear_fact_check if update_params.key?(:definition) && update_params[:definition] != meaning.definition
        meaning.update!(update_params)
        render json: serialize_meaning(meaning)
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        meaning.destroy!
        head :no_content
      end

      # ファクトチェックの指摘を「読んで判断した」と記録する。
      #
      # 判定そのものは消さない。消すと、何を見て決めたのかが後から辿れなくなる。
      # 一覧の警告色だけを引っ込め、確認済みとして畳む。
      # もう一度考え直したくなったら acknowledged: false で戻せる。
      def acknowledge
        acknowledged = params.key?(:acknowledged) ? ActiveModel::Type::Boolean.new.cast(params[:acknowledged]) : true
        meaning.update!(fact_check_acknowledged_at: acknowledged ? Time.current : nil)
        render json: serialize_meaning(meaning)
      end

      # 並び替え。渡された順に position を振り直す。
      # 1件ずつの update を並べると、途中で失敗したとき順序が壊れるのでまとめて行う。
      def reorder
        ids = Array(params[:ids]).map(&:to_s)
        targets = item.meanings.where(id: ids).index_by(&:id)
        return render(json: { error: "並び替える対象がありません" }, status: :unprocessable_entity) if targets.empty?

        Meaning.transaction do
          ids.each_with_index do |id, index|
            targets[id]&.update!(position: index)
          end
        end
        render json: { meanings: item.meanings.reload.ordered.map { |m| serialize_meaning(m) } }
      end

      private

      attr_reader :item, :meaning

      def set_item
        @item = current_user.items.find(params[:item_id])
      end

      def set_meaning
        @meaning = item.meanings.find(params[:id])
      end

      def create_params
        permitted.reverse_merge(language_code: "ja")
      end

      def update_params
        permitted
      end

      def permitted
        params.require(:meaning)
              .permit(:definition, :example_sentence, :detail_level, :language_code, :kind)
              .to_h.symbolize_keys
              .tap { |h| h[:detail_level] = Meaning.normalize_level(h[:detail_level]) if h.key?(:detail_level) }
              .tap { |h| h[:kind] = Meaning.normalize_kind(h[:kind]) if h.key?(:kind) }
      end

      def serialize_meaning(record)
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
    end
  end
end
