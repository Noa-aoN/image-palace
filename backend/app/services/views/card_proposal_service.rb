# frozen_string_literal: true

module Views
  # 指示から「これから作るカード」の案を出す。作りはしない。
  #
  # カードを作ると1枚につき1クレジット（＝実費）が出ていく。承認なしに AI の判断で
  # 何枚も作られると、意図しない出費になる。そこで提案と作成を分け、
  # ここでは案を返すだけにしてある。作るのは利用者が枚数を見て決めたあと。
  #
  # 既に持っているカードは提案しない（同じ単語のカードが増えても嬉しくない）。
  class CardProposalService
    class ProposalError < StandardError; end

    DEFAULT_MODEL = "gpt-4o-mini"
    # 1回に提案する枚数の上限。多すぎると承認の判断ができない
    MAX_COUNT = 20
    DEFAULT_COUNT = 8
    MAX_INSTRUCTION_LENGTH = AiEditService::MAX_INSTRUCTION_LENGTH
    # 重複判定のために見る手持ちカードの数
    EXISTING_SAMPLE = 300

    Proposal = Struct.new(:title, :reason, keyword_init: true)
    Result = Struct.new(:proposals, :notes, keyword_init: true)

    def self.call(view:, instruction:, count: DEFAULT_COUNT)
      new(view:, instruction:, count:).call
    end

    def initialize(view:, instruction:, count:)
      @view = view
      @user = view.user
      @instruction = instruction.to_s.strip
      # 未指定（nil や空文字）は既定に落とす。to_i で 0 になると1枚しか出ない
      requested = count.presence&.to_i || DEFAULT_COUNT
      @count = requested.clamp(1, MAX_COUNT)
    end

    def call
      raise ProposalError, "指示を入力してください" if @instruction.blank?
      raise ProposalError, "指示が長すぎます（#{MAX_INSTRUCTION_LENGTH}文字以内）" if @instruction.length > MAX_INSTRUCTION_LENGTH

      moderation = Moderation::PromptModerator.call(@instruction)
      unless moderation.allowed?
        Rails.logger.warn "[Moderation] BLOCKED canvas_card_proposal user_id=#{@user.id} category=#{moderation.category}"
        raise ProposalError, moderation.message
      end

      parsed = request_proposals
      Result.new(proposals: normalize(parsed["cards"]), notes: parsed["notes"].presence)
    end

    private

    def request_proposals
      response = Ai::Chat.call(
        kind: "canvas_card_proposal",
        model: DEFAULT_MODEL,
        user: @user,
        messages: [
          { role: "system", content: system_prompt },
          { role: "user", content: user_prompt }
        ],
        response_format: { type: "json_object" }
      )

      JSON.parse(response.dig("choices", 0, "message", "content").to_s)
    rescue Ai::Chat::LimitExceeded => e
      raise ProposalError, e.message
    rescue JSON::ParserError
      raise ProposalError, "提案を読み取れませんでした。指示を変えてお試しください。"
    end

    def system_prompt
      <<~PROMPT
        あなたは学習用カードの設計者です。利用者の指示に沿って、新しく作るべきカードの見出し語を提案します。

        制約:
        - 見出し語は短く（40文字以内）、1枚1概念にする
        - すでに持っているカードと同じもの・言い換えに過ぎないものは提案しない
        - 指示に対して不要な水増しはしない。#{@count}件を上限に、意味のあるものだけ返す
        - reason は「なぜこのカードが要るか」を20文字程度で

        JSON で返す: {"cards":[{"title":"...","reason":"..."}],"notes":"補足があれば"}
      PROMPT
    end

    def user_prompt
      <<~PROMPT
        指示: #{@instruction}

        いまキャンバスに載っているカード:
        #{placed_titles.presence || "（なし）"}

        すでに持っているカード（これらは提案しない）:
        #{existing_titles.presence || "（なし）"}
      PROMPT
    end

    def placed_titles
      @view.view_items.includes(:item).filter_map { |vi| vi.item&.title }.join("、")
    end

    def existing_titles
      @existing_titles ||= @user.items.order(created_at: :desc).limit(EXISTING_SAMPLE).pluck(:title)
      @existing_titles.join("、")
    end

    # AI の出力はそのまま信じない。空・長すぎ・重複・手持ちと同じものは落とす
    def normalize(cards)
      return [] unless cards.is_a?(Array)

      owned = @user.items.pluck(:title).map { |title| title.to_s.strip.downcase }.to_set
      seen = Set.new

      cards.filter_map do |card|
        title = card.is_a?(Hash) ? card["title"].to_s.strip : nil
        next if title.blank? || title.length > Item::MAX_TITLE_LENGTH

        key = title.downcase
        next if owned.include?(key) || seen.include?(key)

        seen << key
        Proposal.new(title: title, reason: card["reason"].to_s.strip.presence)
      end.first(@count)
    end
  end
end
