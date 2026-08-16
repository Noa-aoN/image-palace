# frozen_string_literal: true

module Billing
  # 作れないまま終わった注文の代金を返す。
  #
  # 画像は先に 1cr もらってから作る。作れなかったときに何も返さないと、
  # **成果物ゼロで金だけ減る**ことになる。無料の作り直しを使い切ってもなお
  # 一度も絵が出なかったなら、その注文はこちらの都合で終わったものとして返す。
  #
  # 返すのは供給側・一時的な失敗だけ。方針違反や入力起因は、入力を変えれば
  # 何度でも無料で試せるので、返す対象にしない（返すと、通らない入力を
  # 出し続けるほど得になってしまう）。
  #
  # 返し方は**新しい付与**。引いたときは期限の近い束から順に取っているが、
  # どの束からいくら取ったかは残していない。完全に戻すには台帳を増やす必要があり、
  # 障害の埋め合わせに払う代償としては重い。期限が少し延びるのは許容する。
  module RefundFailedGeneration
    module_function

    # 返す対象の失敗。
    #
    #   quota     … 供給側の枯渇。利用者には直しようがない
    #   temporary … 通信・混雑。時間を置けば直り得たはずのもの
    #
    # content_policy / invalid_input は入力を変えれば無料で試せるので入れない。
    REFUNDABLE_KINDS = %w[quota temporary].freeze

    # 返したことを残す印。**これが二重返却の唯一の歯止め**。
    # ジョブは何度でも走り得る（再送・手動実行）ので、金額を動かす前に必ず見る。
    REFUNDED_AT_KEY = "generation_refunded_at"
    REFUNDED_POINTS_KEY = "generation_refunded_points"

    # 返したなら true。返さなかった理由はログに残す（黙って通ると調べようがない）
    def call(item, now: Time.current)
      return false unless eligible?(item)

      points = refund_points(item)
      return false if points <= 0

      item.with_lock do
        # 施錠のあとにもう一度見る。同時に2つ走ったとき、
        # 先に入った方の印を見ずに二重で返してしまわないようにする
        return false if refunded?(item.reload)

        item.user.grant_credits!(
          points,
          kind: "compensation",
          expires_at: ::Billing::CreditExpiryPolicy.expires_at(now),
          metadata: { "reason" => "generation_failed", "item_id" => item.id }
        )
        mark_refunded!(item, points, now)
      end

      Rails.logger.info(
        "[RefundFailedGeneration] REFUNDED item_id=#{item.id} points=#{points} kind=#{item.generation_failure_kind}"
      )
      true
    end

    # 返してよいか。ここを通ったものだけが金額を動かす
    def eligible?(item)
      return false if item.nil? || item.user.nil?
      return false if refunded?(item)
      # 一度でも絵が出ていれば、注文は果たされている
      return false if produced?(item)
      return false unless REFUNDABLE_KINDS.include?(item.generation_failure_kind.to_s)

      # 無料の作り直しを使い切るまでは、まだ終わっていない
      ::Images::RetryPolicy.free_retries(item) >= ::Images::RetryPolicy::FREE_RETRY_LIMIT
    end

    def refunded?(item)
      (item.metadata || {})[REFUNDED_AT_KEY].present?
    end

    # 一度でも成果物を受け取ったか。
    # 作り直しで失敗した場合、前の絵が残っているのでここで弾かれる（返さない）
    def produced?(item)
      item.medias.exists?
    end

    # 返す額。**そのカードで実際に引いた額**を返す（モデルごとに単価が違う）。
    # 記録から引くのは、単価表が後から変わっても、払った額と食い違わせないため
    def refund_points(item)
      charged = CreditTransaction.where(user_id: item.user_id, item_id: item.id, kind: "consumption")
                                 .sum(:delta)
      # 記録は消費を負で持つ。返すのはその絶対値
      charged.negative? ? -charged : 0
    end

    def mark_refunded!(item, points, now)
      metadata = (item.metadata || {}).dup
      metadata[REFUNDED_AT_KEY] = now.iso8601
      metadata[REFUNDED_POINTS_KEY] = points
      item.update!(metadata: metadata)
    end
  end
end
