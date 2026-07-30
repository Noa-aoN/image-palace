module Moderation
  # ユーザー入力プロンプトを生成前に検査し、明確にポリシー違反となる語を含むものを弾く。
  # 画像生成 API を呼ぶ前段（Items::CreateService）で使い、安全性・コスト・規約遵守を担保する。
  #
  #   result = Moderation::PromptModerator.call("photosynthesis")
  #   result.allowed?  # => true
  #   result.category  # => nil（許可時）/ "latin" や "cjk"（ブロック時）
  #
  # 2段構成:
  #   1. ローカルのブロックリスト（オフライン・即時・確実）
  #   2. OpenAI Moderation API（OpenaiModerator）。1 を通ったものだけ問い合わせる。
  #      ブロック時の category は "openai:sexual/minors" のようにプレフィックス付きで返す
  class PromptModerator
    BLOCKLIST_PATH = Rails.root.join("config", "moderation_blocklist.yml")

    Result = Struct.new(:allowed, :category, :term, keyword_init: true) do
      def allowed?
        allowed
      end

      def blocked?
        !allowed
      end
    end

    def self.call(text)
      new.call(text)
    end

    # ブロックリストはプロセス起動時に一度だけ読み込み、以後はメモ化する。
    # 更新時はデプロイ（プロセス再起動）で反映する。
    def self.blocklist
      @blocklist ||= load_blocklist
    end

    def self.reset_blocklist!
      @blocklist = nil
    end

    def self.load_blocklist
      raw = YAML.safe_load_file(BLOCKLIST_PATH) || {}
      {
        latin: Array(raw["latin"]).map { |term| normalize(term) }.reject(&:blank?),
        cjk: Array(raw["cjk"]).map { |term| normalize(term) }.reject(&:blank?)
      }
    rescue Errno::ENOENT
      { latin: [], cjk: [] }
    end

    def self.normalize(text)
      NormalizePromptService.call(text)
    end

    def call(text)
      normalized = self.class.normalize(text)
      return Result.new(allowed: true) if normalized.blank?

      blocklist = self.class.blocklist

      term = blocklist[:latin].find { |t| latin_match?(normalized, t) }
      return Result.new(allowed: false, category: "latin", term: term) if term

      term = blocklist[:cjk].find { |t| normalized.include?(t) }
      return Result.new(allowed: false, category: "cjk", term: term) if term

      # ブロックリストを通ったものだけ外部 API へ（無駄な呼び出しとレイテンシを避ける）
      openai = OpenaiModerator.call(text)
      return Result.new(allowed: true) if openai.allowed?

      Result.new(allowed: false, category: "openai:#{openai.category}", term: nil)
    end

    private

    # 半角英数の語は単語境界で判定し、別語への巻き込み（"sex" in "sussex"）を防ぐ。
    # 語自体に空白が含まれる場合（"child porn"）はフレーズとして境界判定する。
    def latin_match?(normalized, term)
      /(?<![[:alnum:]])#{Regexp.escape(term)}(?![[:alnum:]])/.match?(normalized)
    end
  end
end
