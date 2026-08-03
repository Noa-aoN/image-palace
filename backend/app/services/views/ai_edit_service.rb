# frozen_string_literal: true

module Views
  # キャンバス（デッキ／フリーボード）を、ことばの指示どおりに組み立て直す。
  #
  # 「このデッキを覚えやすい順に並べ替えて」「原因と結果を線でつないで」といった、
  # ユーザーが手でやっている作業を代わりにやる。
  #
  # AI を無駄に使わないための工夫が2つ。
  #
  #   1. 候補カードは AI に探させない。指示文とキャンバスの中身から DB 側で絞ってから渡す。
  #      蔵書が何千枚になっても、AI に渡る量は一定に保たれる。
  #   2. 呼び出しは1回だけ。計画（追加・配置・接続）をまとめて出させ、こちら側で適用する。
  #
  # AI の出力はそのまま信じない。id は必ず本人のものか、キャンバスに載っているものかを
  # 確かめてから使う。知らない id は黙って捨てる。
  class AiEditService
    class EditError < StandardError; end

    DEFAULT_MODEL = "gpt-4o-mini"
    # AI に見せる候補カードの上限。増やすほど賢くなるが、その分だけ高くなる
    MAX_CANDIDATES = 60
    # 1回の指示で動かせる量の上限（暴走しても被害を限る）
    MAX_OPERATIONS = 100
    MAX_INSTRUCTION_LENGTH = 500

    # 使える札を選ぶところからやるか、いま載っているものだけで組み直すか
    MODES = %w[select placed_only].freeze
    DEFAULT_MODE = "placed_only"

    # フリーボードの座標系。だいたいこの範囲に収まるよう AI に伝える
    BOARD_WIDTH = 1600
    BOARD_HEIGHT = 1000

    Result = Struct.new(:summary, :added, :removed, :placed, :connected, keyword_init: true)

    def self.call(view:, instruction:, mode: DEFAULT_MODE)
      new(view:, instruction:, mode:).call
    end

    def initialize(view:, instruction:, mode:)
      @view = view
      @user = view.user
      @instruction = instruction.to_s.strip
      @mode = MODES.include?(mode.to_s) ? mode.to_s : DEFAULT_MODE
    end

    def call
      raise EditError, "指示を入力してください" if @instruction.blank?
      raise EditError, "指示が長すぎます（#{MAX_INSTRUCTION_LENGTH}文字以内）" if @instruction.length > MAX_INSTRUCTION_LENGTH
      raise EditError, "このキャンバスは対象外です" unless @view.deck? || @view.freeboard?

      plan = request_plan
      apply!(plan)
    end

    private

    # --- 材料をそろえる -----------------------------------------------------

    def placed
      @placed ||= @view.view_items.includes(:item).order(:position, :created_at).to_a
    end

    def placed_items
      @placed_items ||= placed.map(&:item).compact
    end

    # AI に見せる候補。指示文に出てくる語で先に絞り、足りない分を最近のカードで埋める。
    # 「探す」ところを AI にやらせないので、蔵書が増えても呼び出しの大きさは変わらない。
    def candidates
      return [] unless @mode == "select"

      @candidates ||= begin
        placed_ids = placed_items.map(&:id)
        matched = search_by_instruction.reject { |item| placed_ids.include?(item.id) }
        remaining = MAX_CANDIDATES - matched.size
        recent = if remaining.positive?
          @user.items.where.not(id: placed_ids + matched.map(&:id))
               .order(created_at: :desc).limit(remaining).to_a
        else
          []
        end
        (matched + recent).first(MAX_CANDIDATES)
      end
    end

    # 指示文を語に割って、題名・タグに当たるカードを拾う。
    # 生 SQL は使わず ActiveRecord のクエリメソッドで組み立てる。
    def search_by_instruction
      words = @instruction.scan(/[\p{Word}]+/).select { |word| word.length >= 2 }.uniq.first(8)
      return [] if words.empty?

      scope = @user.items.left_joins(:tags)
      condition = words.map { "items.title ILIKE ? OR tags.name ILIKE ?" }.join(" OR ")
      values = words.flat_map { |word| [ "%#{word}%", "%#{word}%" ] }
      scope.where(condition, *values).distinct.limit(MAX_CANDIDATES).to_a
    end

    # --- AI に計画を立てさせる ----------------------------------------------

    def request_plan
      response = Ai::Chat.call(
        kind: "canvas_edit",
        user: @user,
        model: model,
        messages: [
          { role: "system", content: system_prompt },
          { role: "user", content: user_message }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      )

      JSON.parse(response.dig("choices", 0, "message", "content").to_s)
    rescue JSON::ParserError => e
      raise EditError, "AI の応答を解釈できませんでした: #{e.message}"
    end

    def system_prompt
      if @view.deck?
        <<~PROMPT
          あなたは学習用のカードデッキを組み立てる編集者です。
          デッキは「カードの並び順」だけを持つ、順番に見ていく形式です。座標はありません。

          利用者の指示に従って、次の JSON のみを返してください。
          {"summary": "何をしたかの日本語の短い説明",
           "add": ["追加するカードのid"],
           "remove": ["デッキから外すカードのid"],
           "order": ["先頭から順に並べたカードのid"]}

          - add / remove / order には、渡された一覧に載っている id だけを使うこと。
          - order には、編集後にデッキへ残る全てのカードを、意図した順に過不足なく並べること。
          - remove はデッキから外すだけで、カードそのものは消えません。
          - 指示に無いことはしないこと。並べ替えを頼まれていないなら order は今のままにする。
        PROMPT
      else
        <<~PROMPT
          あなたは考えを図にまとめる編集者です。
          フリーボードは、カードを平面に置き、カード同士を線でつなぐ形式です。

          利用者の指示に従って、次の JSON のみを返してください。
          {"summary": "何をしたかの日本語の短い説明",
           "add": ["追加するカードのid"],
           "remove": ["ボードから外すカードのid"],
           "placements": [{"item_id": "id", "x": 0, "y": 0}],
           "edges": [{"source": "id", "target": "id", "label": "線の見出し（不要なら空文字）"}]}

          - add / remove / placements / edges には、渡された一覧に載っている id だけを使うこと。
          - 座標は x が 0〜#{BOARD_WIDTH}、y が 0〜#{BOARD_HEIGHT} の範囲。
            カードは幅 220・高さ 260 程度なので、重ならないよう 260 以上は離すこと。
          - 意味のまとまりが目で分かる配置にすること。
            流れがあるものは左から右または上から下へ、対比は左右に、
            まとまりは近くに寄せ、別のまとまりとは間を空ける。
          - edges は編集後のボードにあるべき線を全て挙げること。ここに無い線は消えます。
            線が要らない指示なら、いまある線をそのまま挙げ直すこと。
          - remove はボードから外すだけで、カードそのものは消えません。
          - 指示に無いことはしないこと。
        PROMPT
      end
    end

    def user_message
      sections = [ "指示: #{@instruction}", "", "キャンバス種別: #{@view.deck? ? 'デッキ（並び順）' : 'フリーボード（平面）'}" ]
      sections << ""
      sections << "いまキャンバスにあるカード:"
      sections << (placed.empty? ? "（なし）" : placed.map { |vi| placed_line(vi) }.join("\n"))

      if @view.freeboard?
        sections << ""
        sections << "いまある線:"
        edges = @view.view_edges.to_a
        sections << (edges.empty? ? "（なし）" : edges.map { |e| "- #{e.source_node_id} -> #{e.target_node_id}#{e.label.present? ? "（#{e.label}）" : ''}" }.join("\n"))
      end

      if @mode == "select"
        sections << ""
        sections << "追加できるカード（この一覧の中からのみ選べます）:"
        sections << (candidates.empty? ? "（なし）" : candidates.map { |item| "- #{item.id}: #{item.title}" }.join("\n"))
      else
        sections << ""
        sections << "※ カードの追加はできません。いまあるカードだけで組み直してください。"
      end

      sections.join("\n")
    end

    def placed_line(view_item)
      title = view_item.item&.title.to_s
      if @view.deck?
        "- #{view_item.item_id}: #{title}（現在#{view_item.position || '-'}番目）"
      else
        "- #{view_item.item_id}: #{title}（x=#{view_item.x.round}, y=#{view_item.y.round}）"
      end
    end

    # --- 計画を適用する -----------------------------------------------------

    def apply!(plan)
      summary = plan["summary"].to_s.strip.presence || "キャンバスを編集しました"
      added = removed = placed_count = connected = 0

      ViewItem.transaction do
        removed = remove_items!(ids_from(plan["remove"]))
        added = add_items!(ids_from(plan["add"]))
        placed_count = @view.deck? ? apply_order!(ids_from(plan["order"])) : apply_placements!(plan["placements"])
        connected = @view.freeboard? ? apply_edges!(plan["edges"]) : 0
      end

      Result.new(summary:, added:, removed:, placed: placed_count, connected:)
    end

    def ids_from(value)
      Array(value).map(&:to_s).uniq.first(MAX_OPERATIONS)
    end

    # 追加できるのは、mode が select のときに渡した候補だけ。
    # AI が別の id を書いてきても通さない。
    def add_items!(ids)
      return 0 if @mode != "select"

      allowed = candidates.map(&:id) & ids
      allowed.count do |item_id|
        view_item = @view.view_items.find_or_initialize_by(item_id: item_id)
        next false if view_item.persisted?

        view_item.position = next_position if @view.deck?
        view_item.save!
        true
      end
    end

    def remove_items!(ids)
      targets = @view.view_items.where(item_id: ids).to_a
      return 0 if targets.empty?

      removed_ids = targets.map(&:item_id)
      @view.view_items.where(item_id: removed_ids).destroy_all
      # 端点が消えた線は残さない
      @view.view_edges.where(source_node_id: removed_ids).or(
        @view.view_edges.where(target_node_id: removed_ids)
      ).delete_all
      # 取り除いたぶんはキャッシュを捨てる
      @placed = nil
      @placed_items = nil
      removed_ids.size
    end

    def next_position
      (@view.view_items.maximum(:position) || 0) + 1
    end

    def apply_order!(ids)
      on_board = @view.view_items.pluck(:item_id)
      ordered = ids & on_board
      return 0 if ordered.empty?

      # 挙げられなかったカードは、後ろへそのまま残す（勝手に消えないように）
      rest = on_board - ordered
      (ordered + rest).each_with_index do |item_id, index|
        @view.view_items.where(item_id: item_id).update_all(position: index + 1, updated_at: Time.current)
      end
      ordered.size
    end

    def apply_placements!(placements)
      on_board = @view.view_items.pluck(:item_id).to_set
      Array(placements).first(MAX_OPERATIONS).count do |placement|
        next false unless placement.is_a?(Hash)

        item_id = placement["item_id"].to_s
        next false unless on_board.include?(item_id)

        @view.view_items.where(item_id: item_id).update_all(
          x: clamp(placement["x"], BOARD_WIDTH),
          y: clamp(placement["y"], BOARD_HEIGHT),
          updated_at: Time.current
        )
        true
      end
    end

    # 画面の外へ飛ばされると見失うため、盤の中に収める
    def clamp(value, max)
      value.to_f.clamp(0, max).round
    end

    def apply_edges!(edges)
      on_board = @view.view_items.pluck(:item_id).to_set
      wanted = Array(edges).first(MAX_OPERATIONS).filter_map do |edge|
        next unless edge.is_a?(Hash)

        source = edge["source"].to_s
        target = edge["target"].to_s
        next if source == target
        next unless on_board.include?(source) && on_board.include?(target)

        { source:, target:, label: edge["label"].to_s.strip.presence }
      end

      # 挙げられた線が編集後の全てになる。挙がらなかったものは消す
      @view.view_edges.destroy_all
      wanted.each do |edge|
        @view.view_edges.create!(
          source_node_id: edge[:source], target_node_id: edge[:target], label: edge[:label]
        )
      end
      wanted.size
    end

    def model
      ENV.fetch("OPENAI_CANVAS_MODEL", ENV.fetch("OPENAI_TEXT_MODEL", DEFAULT_MODEL))
    end
  end
end
