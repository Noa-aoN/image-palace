# frozen_string_literal: true

module Views
  # 指示から「これから作るカード」の案を出す。作りはしない。
  #
  # カードを作ると1枚につき1クレジット（＝実費）が出ていく。承認なしに AI の判断で
  # 何枚も作られると、意図しない出費になる。そこで提案と作成を分け、
  # ここでは案を返すだけにしてある。作るのは利用者が枚数を見て決めたあと。
  #
  # 語を選ぶところは GenerateWordsService に任せる。ワードリスト作成・アクロポリスと
  # 同じ仕事なので、прompt を別に持つと片方だけ育って挙動がずれる。
  # あちらは「画像化しやすい具体名詞を優先」「難しさ4段階」「不適切な題材を避ける」まで
  # 作り込んであり、カードにする語を選ぶ用途にそのまま合う。
  #
  # ここが受け持つのはキャンバス固有の事情だけ:
  #   - 指示の検査（外部へ渡る前のモデレーション）
  #   - すでに持っている／載っているカードを除外する
  class CardProposalService
    class ProposalError < StandardError; end

    # 1回に提案する枚数の上限。多すぎると承認の判断ができない
    MAX_COUNT = 20
    DEFAULT_COUNT = 8
    MAX_INSTRUCTION_LENGTH = AiEditService::MAX_INSTRUCTION_LENGTH
    # 除外リストに載せる手持ちカードの数（プロンプトの肥大化を抑える）
    EXCLUDE_SAMPLE = 200

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
      @count = (count.presence&.to_i || DEFAULT_COUNT).clamp(1, MAX_COUNT)
    end

    def call
      raise ProposalError, "指示を入力してください" if @instruction.blank?
      raise ProposalError, "指示が長すぎます（#{MAX_INSTRUCTION_LENGTH}文字以内）" if @instruction.length > MAX_INSTRUCTION_LENGTH

      moderation = Moderation::PromptModerator.call(@instruction)
      unless moderation.allowed?
        Rails.logger.warn "[Moderation] BLOCKED canvas_card_proposal user_id=#{@user.id} category=#{moderation.category}"
        raise ProposalError, moderation.message
      end

      Result.new(proposals: propose, notes: nil)
    end

    private

    def propose
      words = GenerateWordsService.call(
        theme: @instruction,
        count: @count,
        exclude: excluded_titles,
        # 難しさは本人の設定に合わせる（ワードリスト作成と同じ基準にする）
        difficulty: @user.setting&.word_difficulty,
        user: @user,
        kind: "canvas_card_proposal"
      )

      words.map { |word| Proposal.new(title: word) }
    rescue GenerateWordsService::GenerationError
      # 出せる語が無かった。エラーにはせず「見つからなかった」として返す
      []
    rescue Ai::Chat::LimitExceeded => e
      raise ProposalError, e.message
    end

    # 手持ちと、いま載っているものは出さない。同じ単語のカードが増えても嬉しくない
    def excluded_titles
      owned = @user.items.order(created_at: :desc).limit(EXCLUDE_SAMPLE).pluck(:title)
      placed = @view.view_items.includes(:item).filter_map { |view_item| view_item.item&.title }

      (owned + placed).uniq
    end
  end
end
