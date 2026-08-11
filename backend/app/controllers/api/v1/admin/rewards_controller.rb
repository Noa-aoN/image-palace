module Api
  module V1
    module Admin
      # 獲得物・実績・ミッションの登録簿を、1つの入口で扱う。
      #
      # 3つは別の表だが、運営から見ると「何を配るか」という1つの話。
      # 画面を分けると、実績を足したのに獲得物を足し忘れる、といった片手落ちが起きる。
      #
      # 手で配る操作（手動付与）は**重要操作**として扱う。理由を必須にし、監査ログに必ず残す。
      class RewardsController < BaseController
        # 配るもの・配る操作は通常運用の範囲
        before_action -> { require_role!(:operator) },
                      only: [ :update_reward, :update_achievement, :update_mission, :grant ]
        def index
          render json: {
            rewards: RewardDefinition.registry.map { |d| serialize_reward(d) },
            achievements: AchievementDefinition.registry.map { |d| serialize_achievement(d) },
            missions: MissionDefinition.registry.map { |d| serialize_mission(d) },
            series: MissionSeries.registry.map { |s| serialize_series(s) },
            kinds: RewardDefinition::KINDS,
            rarity_levels: RewardDefinition::RARITY_LEVELS,
            categories: AchievementDefinition::CATEGORY_ORDER,
            cadences: MissionDefinition::CADENCES,
            condition_types: ::Achievements::Conditions.options
          }
        end

        # 獲得物の編集。名前・説明・レア度・分類・公開。
        # 条件（どうすれば手に入るか）は実績側が持つので、ここでは触らない
        def update_reward
          definition = RewardDefinition.find(params[:id])
          before = definition.slice(:name, :rarity_level, :published)

          if definition.update(reward_params)
            audit!("reward_definition_update", target: definition,
                                               details: { key: definition.key, before: before, after: reward_params.to_h })
            render json: { reward: serialize_reward(definition) }
          else
            render json: { errors: definition.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def update_achievement
          definition = AchievementDefinition.find(params[:id])
          before = definition.slice(:condition_target, :enabled, :published)

          if definition.update(achievement_params)
            audit!("achievement_definition_update", target: definition,
                                                    details: { key: definition.key, before: before })
            render json: { achievement: serialize_achievement(definition) }
          else
            render json: { errors: definition.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def update_mission
          definition = MissionDefinition.find(params[:id])
          before = definition.slice(:condition_target, :enabled, :published, :starts_at, :ends_at)

          if definition.update(mission_params)
            audit!("mission_definition_update", target: definition,
                                                details: { key: definition.key, before: before })
            render json: { mission: serialize_mission(definition) }
          else
            render json: { errors: definition.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # 手で配る。表彰など、条件では表せないものに使う。
        #
        # 理由を必須にするのは、あとから見て「なぜ配ったか」が分からない記録を残さないため。
        # 誰に・何を・いつ・なぜ、が揃って初めて記録として使える。
        def grant
          user = User.find(params[:user_id])
          definition = RewardDefinition.find_by!(key: params[:reward_key])
          reason = params[:reason].to_s.strip

          return render(json: { error: "理由を書いてください" }, status: :unprocessable_entity) if reason.blank?

          granted = ::Achievements::Granter.grant_rewards(
            user: user, rewards: [ { "type" => "reward", "key" => definition.key } ],
            source: "manual", source_ref: reason
          )
          audit!("reward_manual_grant", target: user,
                                        details: { reward_key: definition.key, reason: reason,
                                                   already_owned: granted.empty? })

          render json: { granted: granted.any?, reward: serialize_reward(definition) }
        end

        private

        def reward_params
          params.require(:reward).permit(:name, :description, :rarity_level, :category, :published, :image_key)
        end

        def achievement_params
          params.require(:achievement).permit(:name, :description, :category, :condition_target,
                                              :position, :enabled, :published)
        end

        def mission_params
          params.require(:mission).permit(:name, :description, :cadence, :condition_target,
                                          :position, :enabled, :published, :starts_at, :ends_at,
                                          :mission_series_id, :series_step)
        end

        def serialize_reward(definition)
          {
            id: definition.id, key: definition.key, kind: definition.kind, kind_label: definition.kind_label,
            name: definition.name, description: definition.description,
            rarity_level: definition.rarity_level, rarity_tier: definition.rarity_tier,
            category: definition.category, published: definition.published?,
            image_path: definition.image_path, builtin: definition.builtin?,
            # 何人が持っているか。配りすぎ・配らなすぎに気づくため
            owned_count: UserReward.where(reward_definition_id: definition.id).count
          }
        end

        def serialize_achievement(definition)
          {
            id: definition.id, key: definition.key, name: definition.name,
            description: definition.description, category: definition.category,
            condition_type: definition.condition_type, condition_target: definition.condition_target,
            position: definition.position, enabled: definition.enabled?, published: definition.published?,
            rewards: definition.rewards, builtin: definition.builtin?,
            completed_count: UserAchievement.where(achievement_definition_id: definition.id)
                                            .where.not(completed_at: nil).count
          }
        end

        def serialize_mission(definition)
          {
            id: definition.id, key: definition.key, name: definition.name,
            description: definition.description, cadence: definition.cadence,
            condition_type: definition.condition_type, condition_target: definition.condition_target,
            position: definition.position, enabled: definition.enabled?, published: definition.published?,
            starts_at: definition.starts_at, ends_at: definition.ends_at,
            mission_series_id: definition.mission_series_id, series_step: definition.series_step,
            rewards: definition.rewards, builtin: definition.builtin?
          }
        end

        def serialize_series(series)
          {
            id: series.id, key: series.key, name: series.name, description: series.description,
            position: series.position, enabled: series.enabled?, published: series.published?,
            builtin: series.builtin?
          }
        end
      end
    end
  end
end
