# frozen_string_literal: true

module Achievements
  # 実績の報酬が変わったとき、**既に達成済みの人へ配り直す**。
  #
  # 評価器は達成済みの実績を触らない（`Evaluator#evaluate_achievements` の
  # 「一度達成したものは触らない」）。これは正しい振る舞いだが、報酬の付け替えと
  # 組み合わせると穴になる。
  #
  #   例: 勲章を「500枚」から「100枚」へ移した。
  #       → すでに100枚を超えている人は再評価されないので、永久に配られない。
  #         500枚に届くと、そこには別の報酬が置かれている。
  #
  # 配り直しは**冪等**。二重には配らない。根拠は3つ重ねてある。
  #
  #   1. すでにその獲得物の行を持つ人は対象から外す（手放した人も含む。
  #      捨てたものを勝手に戻さない）
  #   2. 出来事の鍵は評価器と同じ（`achievement:<実績>:<獲得物>`）ので、
  #      同じ実績から配られていれば一意制約で弾かれる
  #   3. 称号・勲章は重ねて持てない（`Granter#record_ownership!`）
  #
  # そのため、本番の行が既に新しい報酬になっていた場合は**何も起きない**。
  # 過去の状態を調べずに走らせられる。
  class BackfillAchievementReward
    Result = Struct.new(:completed, :already_had, :granted, :dry_run, keyword_init: true) do
      def skipped
        completed - already_had - granted
      end
    end

    class MissingDefinition < StandardError; end

    def self.call(...)
      new(...).call
    end

    def initialize(achievement_key:, reward_key:, dry_run: false, now: Time.current)
      @achievement_key = achievement_key.to_s
      @reward_key = reward_key.to_s
      @dry_run = dry_run
      @now = now
    end

    def call
      # **先に両方を引く。** 後回しにすると、達成者が0人のときに鍵の誤りへ触れず、
      # 綴りを間違えたまま「0人」と報告してしまう（気づけない失敗になる）
      verify_definitions!

      completed_ids = completed_user_ids
      already_ids = already_holding_ids(completed_ids)
      todo_ids = completed_ids - already_ids

      granted = @dry_run ? 0 : grant_to(todo_ids)

      Result.new(completed: completed_ids.size, already_had: already_ids.size,
                 granted: granted, dry_run: @dry_run)
    end

    private

    def verify_definitions!
      definition
      reward
    end

    def definition
      @definition ||= AchievementDefinition.find_by(key: @achievement_key) ||
                      raise(MissingDefinition, "実績 #{@achievement_key} がありません")
    end

    def reward
      @reward ||= RewardDefinition.find_by(key: @reward_key) ||
                  raise(MissingDefinition, "獲得物 #{@reward_key} がありません")
    end

    def completed_user_ids
      UserAchievement.where(achievement_definition_id: definition.id)
                     .where.not(completed_at: nil)
                     .pluck(:user_id)
    end

    # 手放した行（revoked_at あり）も「持っている」に数える。
    # 自分で外したものを、配り直しで勝手に戻さないため
    def already_holding_ids(user_ids)
      return [] if user_ids.empty?

      UserReward.where(reward_definition_id: reward.id, user_id: user_ids).pluck(:user_id)
    end

    def grant_to(user_ids)
      return 0 if user_ids.empty?

      granted = 0
      User.where(id: user_ids).find_each do |user|
        result = Granter.grant(
          user: user, reward: reward, source: "achievement", source_ref: definition.key,
          now: @now, event_key: "achievement:#{definition.key}:#{reward.key}"
        )
        granted += 1 if result
      end
      granted
    end
  end
end
