# frozen_string_literal: true

module Achievements
  # 位を、いまの契約状態に合わせる。
  #
  # ## なぜ「同期」なのか
  #
  # 決済の便りは、遅れて届く・順番が入れ替わる・同じものが2度届く。
  # 「契約したら配る」「解約したら剥がす」と便りごとに手続きを書くと、
  # 順番が入れ替わっただけで**格上げの前に格下げが走り**、位が消える。
  #
  # だからどの便りも入口はここ1つにして、**いまの契約を見て、あるべき姿にする**。
  # 何度呼んでも、どの順で呼んでも、行き着く先は同じになる。
  #
  # ## やること（5段）
  #
  #   1. いまの段（tier）を、契約から決める … 契約が無ければ free
  #   2. その段の位を引く
  #   3. 持っていなければ配る（初回なら初取得日が入る／取り直しなら復帰）
  #   4. **他の段の位を外す** … 格上げ・格下げで前の位が残らないように
  #   5. 名乗りが空いたら、新しい位を名乗らせる
  #
  # ## 位と名乗りは別
  #
  # 位は契約に付いてくるもので、選べない。名乗り（equipped）は本人が選ぶもの。
  # だから位を配っても、本人が別の称号を名乗っているなら**それを奪わない**。
  # 名乗りを上書きするのは、何も名乗っていないときだけ。
  module SyncPlanTitle
    module_function

    # 返り値は同期後の段（"free" / "standard" / …）。呼び出し側のログ用
    def call(user:, now: Time.current)
      return nil if user.nil?

      tier = current_tier(user)
      rank = RewardDefinition.rank_for_tier(tier)

      # 段に対応する位が無い（買い切りだけ、など）。**何も外さない**。
      # 引けなかっただけかもしれないのに剥がすと、位が消える
      return tier if rank.nil?

      grant_rank(user, rank, now)
      revoke_other_ranks(user, rank, now)
      equip_if_free(user, rank)

      tier
    end

    # 決済の流れから呼ぶとき用。**位のために支払いを止めない**。
    # ここで落ちても契約とクレジットは正しく進み、次の便り（または一括同期）で揃う
    def sync_quietly(user:, now: Time.current)
      call(user: user, now: now)
    rescue StandardError => e
      Rails.logger.warn "[SyncPlanTitle] FAILED user_id=#{user&.id} #{e.class}: #{e.message}"
      nil
    end

    # いまの段。契約が無い・切れているなら free。
    #
    # 拾うのは active / trialing のみ。past_due・unpaid は入らないので、
    # **支払いが滞れば自然に free へ落ちる**（期末失効の便りを待たなくてよい）。
    #
    # user.active_subscription は使わない。**一度読むと、その user では覚えたまま**になる。
    # 契約を書き込んだ直後に呼ばれる道（SubscriptionSync）では、
    # 書き込む前の姿を見て「契約が無い」と判じ、配ったばかりの位を外してしまう
    ACTIVE_STATUSES = %w[active trialing].freeze

    def current_tier(user)
      Subscription.where(user_id: user.id, status: ACTIVE_STATUSES)
                  .order(started_at: :desc)
                  .includes(:plan).first&.plan&.tier.presence || "free"
    end

    # 配る。既に持っていれば Granter が黙って諦める（二重に配らない）。
    # 手放していた行があれば、その行が復帰する（初めて手にした日は変わらない）
    def grant_rank(user, rank, now)
      held = UserReward.find_by(user_id: user.id, reward_definition_id: rank.id)
      return if held&.held?

      Granter.grant(
        user: user, reward: rank, source: "manual", source_ref: "plan_sync",
        now: now,
        # 契約し直すたびに新しい出来事。**時刻を鍵にしない**
        # （同じ秒に解約と再契約が並ぶと同じ鍵になり、位が戻らない）。
        # 二重配布はここでは防がない。上の held? と、
        # 持ち物側の一意制約（1人1定義1行）が防いでいる
        event_key: "subscription:#{rank.key}:#{SecureRandom.uuid}",
        # 位は契約で決まるもの。届いても「獲得しました」とは言わない。
        # 便りの再送で同じ知らせが何度も出るのを避ける意味もある
        notify: false
      )
    end

    # いまの段以外の位を外す。行は消さない（また契約したときのために履歴を残す）
    def revoke_other_ranks(user, rank, now)
      other_ids = RewardDefinition.subscription_ranks.map(&:id) - [ rank.id ]
      return if other_ids.empty?

      UserReward.held.where(user_id: user.id, reward_definition_id: other_ids).find_each do |reward|
        reward.revoke!(now)
      end
    end

    # 名乗りが空いていれば、新しい位を名乗らせる。
    # 既に何かを名乗っているなら触らない（本人が選んだものを奪わない）
    def equip_if_free(user, rank)
      return if UserReward.held.joins(:reward_definition)
                          .where(user_id: user.id, equipped: true).exists?

      reward = UserReward.held.find_by(user_id: user.id, reward_definition_id: rank.id)
      return if reward.nil?

      Showcase.star!(reward)
      Showcase.trim!(user, "title")
    end
  end
end
