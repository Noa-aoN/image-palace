# frozen_string_literal: true

module Images
  # 失敗したカードを「作り直してよいか」を決める。
  #
  # 作り直しは失敗からなら無料にしてある。渡せていないものに課金しないという判断で、これは変えない。
  # ただし無料であることと、**何度でも押せること**は別の話だった。
  # 押すたびに供給側へ1回問い合わせが飛び、そのたびにこちらの原価が出る。
  # 上限が無いので、1人が押し続けるだけで費用が伸び続ける（毎分20回まで通る）。
  #
  # 判断は2つに分ける。
  #
  #   1. そもそも押して直るのか（失敗の種類）
  #      方針に触れた・入力から絵を決められない、は同じ入力なら必ず同じ結果になる。
  #      押させると、必ず失敗すると分かっている呼び出しに毎回お金がかかる。
  #      利用者にとっても、直らないものを押し続けることになる。
  #      道は「入力を変える」しかないので、そう伝えて止める。
  #
  #   2. 何度まで無料か
  #      時間を置けば直るものは押す意味がある。ただし4回続けて失敗するなら、
  #      それはもう「一時的」ではない。無料はそこで打ち切り、以降はクレジットで作り直す。
  module RetryPolicy
    # 無料で作り直せる回数（1枚あたり）。時間を置いて直るものは、この範囲でだいたい直る
    FREE_RETRY_LIMIT = 3

    # 入力を変えない限り、押しても必ず同じ結果になる種類
    INPUT_BOUND_KINDS = %w[content_policy invalid_input].freeze

    Decision = Struct.new(:allowed, :charge, :reason, keyword_init: true) do
      def allowed? = allowed
      def charge? = charge
    end

    module_function

    # target … Item / SpacePoint（失敗の種類と回数を metadata に持つもの）
    # changed_input … 語や指示が変わったか。変わっていれば別の入力なので、種類の縛りは外れる
    def decide(target:, changed_input:, now: Time.current)
      kind = kind_of(target)

      if INPUT_BOUND_KINDS.include?(kind) && !changed_input
        return Decision.new(allowed: false, charge: false, reason: input_bound_reason(kind))
      end

      if kind == "quota" && provider_down?(now)
        return Decision.new(allowed: false, charge: false, reason: quota_reason)
      end

      # 入力を変えたのなら、それは別の絵の注文。回数の勘定は引き継がない
      return Decision.new(allowed: true, charge: false, reason: nil) if changed_input

      if free_retries(target) >= FREE_RETRY_LIMIT
        return Decision.new(allowed: true, charge: true, reason: nil)
      end

      Decision.new(allowed: true, charge: false, reason: nil)
    end

    # 前に注文したものと今の注文が違うか。
    #
    # 指紋を持たない行（この仕組みより前に失敗したもの）は、判断がつかないので通す。
    # 止めてしまうと、既に失敗しているカードが直しようもなく残る。
    # 通しても、その1回で指紋が残るので、次からは正しく判断できる。
    def input_changed?(target, include_meaning: false)
      before = (target.metadata || {})["prompt_fingerprint"]
      return true if before.blank?

      before != Images::PromptFingerprint.call(target, include_meaning: include_meaning).digest
    end

    # 失敗の種類。種類を持たない古い行は、記録してある例外の名前から見当をつける。
    # 400 は「送った内容が受け付けられなかった」なので、同じ入力なら結果も同じになる
    def kind_of(target)
      kind = target.generation_failure_kind
      return kind if kind.present?

      target.generation_error_code == "Faraday::BadRequestError" ? "invalid_input" : nil
    end

    # そのまま押して直り得るか（画面が「作り直す」を出すかの判断に使う）。
    # 入力を変えれば別の注文になるので、そちらは常に通る
    def retryable?(target, now: Time.current)
      decide(target: target, changed_input: false, now: now).allowed?
    end

    # 使った無料回数。入力を変えたら 0 に戻す（別の注文になるため）
    def free_retries(target)
      (target.metadata || {})["free_retries"].to_i
    end

    def count_free_retry!(target, reset: false)
      metadata = (target.metadata || {}).dup
      metadata["free_retries"] = reset ? 0 : free_retries(target) + 1
      target.update!(metadata: metadata)
    end

    def provider_down?(now = Time.current)
      ProviderIncident.where(kind: ProviderIncident::QUOTA_EXHAUSTED)
                      .latest_first.first&.ongoing?(now: now) || false
    end

    def input_bound_reason(kind)
      if kind == "content_policy"
        "この入力では画像を作れません。作り直しても同じ結果になるので、単語か指示を変えてからお試しください。"
      else
        "この入力からは絵を決められませんでした。作り直しても同じ結果になるので、" \
          "単語をより具体的にするか、画像への指示を添えてお試しください。"
      end
    end

    def quota_reason
      "いま画像を作れない状態が続いています。復旧までお待ちください（運営に通知済みです）。"
    end
  end
end
