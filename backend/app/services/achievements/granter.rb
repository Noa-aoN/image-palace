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

    # 1つ配る。
    #
    # 返り値は「配った UserReward」または nil（配らなかった）。
    #
    # ## 二重に配らないことと、正しく重ねることの両立
    #
    # 同じ出来事から2回来たときは配らない（event_key で弾く）。
    # 別の出来事なら、宝物は重ねて持てる（quantity を増やす）。
    # **数量だけを見ていると、この2つは区別が付かない。**
    #
    #   実績・ミッション … event_key は定義の鍵（1人1回しか達成しない）
    #   手で配る         … 理由＋時刻（同じ理由でも別の時なら別の出来事）
    def grant(user:, reward:, source: "achievement", source_ref: nil, notify: true, now: Time.current,
              event_key: nil)
      return nil unless reward.grantable?(now)

      key = event_key.presence || default_event_key(reward, source, source_ref)

      granted = nil
      ActiveRecord::Base.transaction do
        # 同じ出来事から2回目なら、ここで弾かれる（unique index が最後の砦）
        UserRewardGrant.create!(
          user: user, reward_definition: reward, granted_at: now,
          source: source, source_ref: source_ref, event_key: key
        )
        granted = record_ownership!(user, reward, source, source_ref, now)
      end

      notify!(user, reward) if notify && granted
      granted
    rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
      # 同じ出来事から2回来た。競合しても静かに諦める
      nil
    end

    # 持ち物側を更新する。**読んでから書かない**（同時に配られると取りこぼす）。
    # 増やせるのは重ねて持てるものだけ。称号・勲章・表彰は2つ目を持たない
    def record_ownership!(user, reward, source, source_ref, now)
      existing = UserReward.find_by(user: user, reward_definition: reward)

      if existing.nil?
        return UserReward.create!(
          user: user, reward_definition: reward, granted_at: now,
          source: source, source_ref: source_ref,
          quantity: 1, first_acquired_at: now, last_acquired_at: now
        )
      end

      # 重ねられないものは、2つ目を配らない（これまでどおり）
      return nil unless reward.stackable?

      UserReward.where(id: existing.id)
                .update_all([ "quantity = quantity + 1, last_acquired_at = ?, updated_at = ?", now, now ])
      existing.reload
    end

    # 出来事の鍵。呼び出し側が渡さないときの既定。
    #
    # 実績・ミッションは source_ref に定義の鍵が入る（1人1回しか達成しない）。
    # 手で配るときは理由と時刻を混ぜる（同じ理由でも別の時なら別の出来事）
    def default_event_key(reward, source, source_ref)
      case source
      when "manual" then "manual:#{reward.key}:#{source_ref}:#{Time.current.to_i}"
      else "#{source}:#{source_ref || reward.key}:#{reward.key}"
      end
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
