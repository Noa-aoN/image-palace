# frozen_string_literal: true

module Achievements
  # 獲得物を配る。
  #
  # **二重に配らない**ことが要。同じ獲得物は1人1つで、DB の一意制約が最後の砦。
  # 競合して2回走っても、2つ目は静かに諦める（例外にしない）。
  #
  # 配ったことは notifications に残す。専用のイベント表は作らない
  # （利用者向けは通知、運営の操作は監査ログ、履歴は user_rewards が持つ）。
  module Granter
    module_function

    # 1つ配る。配れたら UserReward、既に持っていれば nil
    def grant(user:, reward:, source: "achievement", source_ref: nil, notify: true, now: Time.current)
      return nil unless reward.grantable?(now)

      granted = UserReward.create!(
        user: user, reward_definition: reward, granted_at: now,
        source: source, source_ref: source_ref
      )
      notify!(user, reward) if notify
      granted
    rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
      # 既に持っている。競合しても静かに諦める
      nil
    end

    # 実績・ミッションの報酬をまとめて配る。配れたものだけ返す
    def grant_rewards(user:, rewards:, source:, source_ref: nil, now: Time.current)
      Array(rewards).filter_map do |entry|
        case entry["type"]
        when "reward"
          definition = RewardDefinition.find_by(key: entry["key"])
          next if definition.nil?

          grant(user: user, reward: definition, source: source, source_ref: source_ref, now: now)
        when "credits"
          grant_credits(user, entry["amount"].to_i, source_ref)
          nil
        end
      end
    end

    # 報酬のクレジット。期限は買い切りと同じ扱いにする
    def grant_credits(user, amount, source_ref)
      return if amount <= 0

      user.grant_credits!(
        amount * ::Billing::POINTS_PER_CREDIT,
        kind: "campaign",
        expires_at: ::Billing::Catalog::CREDIT_LIFETIME.from_now,
        metadata: { "achievement" => source_ref }
      )
    end

    # 通知は既存の仕組みに乗せる。落ちても配ったことは取り消さない
    # （届かない通知より、配られていない獲得物のほうが困る）。
    # ただし理由はログに出す。種別の登録漏れは静かに起きて、気づけない
    def notify!(user, reward)
      Notifications::CreateService.call(
        user: user,
        kind: "reward_granted",
        title: reward.notify_title.presence || "#{reward.kind_label}を獲得しました",
        body: reward.notify_body.presence || "「#{reward.name}」",
        url: "/achievements?highlight=#{reward.key}",
        payload: { "reward_key" => reward.key, "kind" => reward.kind }
      )
    rescue StandardError => e
      Rails.logger.warn "[Achievements] NOTIFY FAILED reward=#{reward.key} #{e.class}: #{e.message}"
    end
  end
end
