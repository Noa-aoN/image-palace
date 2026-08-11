# frozen_string_literal: true

module Wikipedia
  # どの言語版の Wikipedia を引くか。
  #
  # いまは日本語しか出していないが、**言語を持たない形では作らない**。
  # あとから言語を足すと、それまでに保存した値がどの言語のものか分からなくなり、
  # 保存済みを全部「たぶん日本語」として扱うしかなくなる。
  #
  # 決め方は上から順に見て、最初に見つかったものを使う。
  #   1. カードの言語（そのカードが何語のものか）
  #   2. 利用者の表示言語
  #   3. ブラウザの言語（Accept-Language）
  #   4. ja
  #
  # 画面に言語の選択を大きく出すのは、使われ方を見てからでよい。
  # ここで持っておけば、出したくなったときに保存済みの値を捨てずに済む。
  module Language
    DEFAULT = "ja"

    # 引ける言語版。増やすときはここに足す。
    # 何でも受けると、`xx.wikipedia.org` のような存在しないホストを叩きに行く
    SUPPORTED = %w[ja en zh ko fr de es it ru pt].freeze

    module_function

    # 候補を上から見て、引ける言語を1つ選ぶ。
    # 「ja-JP」「en-US」のような地域付きも受ける（Wikipedia の版は言語だけで決まる）
    def resolve(*candidates)
      candidates.flatten.compact.each do |candidate|
        code = normalize(candidate)
        return code if code
      end

      DEFAULT
    end

    def normalize(value)
      code = value.to_s.strip.downcase.split(/[-_]/).first
      return nil if code.blank?

      SUPPORTED.include?(code) ? code : nil
    end

    def supported?(value)
      normalize(value).present?
    end

    # その言語版の入口。ここを分けておけば、言語を足しても呼び出し側は変わらない
    def base_url(code)
      "https://#{normalize(code) || DEFAULT}.wikipedia.org"
    end

    # Accept-Language から、引ける言語を拾う。
    # 品質値（;q=）の順は見ない。並び順が優先度になっている実装がほとんどで、
    # ここで厳密に解いても選ばれる言語は変わらない
    def from_accept_language(header)
      header.to_s.split(",").map { |part| part.split(";").first }.find { |code| supported?(code) }
    end
  end
end
