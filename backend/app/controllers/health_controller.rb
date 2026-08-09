# frozen_string_literal: true

# Fly のヘルスチェック（/up）。15秒ごとに叩かれる。
#
# ここで**ジョブのワーカーが生きているか**も見る。ワーカーは別マシンで動いており、
# ワーカーの中から見張ってもワーカーが死んでいたら誰も気づけないため、
# 定期的に必ず動くこの経路に相乗りさせている。
#
# 見張りの結果でこのエンドポイントの成否は変えない。ワーカーが落ちても Web は
# 提供できているので、ここを落とすと app まで再起動されて事態が悪化する。
class HealthController < ActionController::Base
  def show
    Jobs::QueueWatchdog.check!

    render plain: "ok"
  end
end
