# frozen_string_literal: true

module Billing
  # いまの決済がテストか本物か。
  #
  # テストの決済も、本物と同じ経路で `credit_transactions` に金額まで記録される。
  # 見分けが付かないと、「今月いくら入ったか」を見ているつもりで
  # 自分で叩いたテストの額を見ることになる。
  #
  # 判断は Stripe の鍵で行う。`sk_test_` / `rk_test_` で始まるものはテスト用。
  # webhook の `livemode` を使う手もあるが、決済から戻ってきたときの取り込み
  # （CheckoutSyncService）にはイベントが無いので、両方の経路で使える鍵側で見る。
  module Mode
    module_function

    def live?
      key = Stripe.api_key.to_s
      key.present? && !key.match?(/\A(sk|rk)_test_/)
    end

    def test?
      !live?
    end

    # 画面に「テストの決済を含む」と出すための目印
    def label
      live? ? "本番" : "テスト"
    end
  end
end
