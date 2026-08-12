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
                      only: [ :create_reward, :create_achievement, :create_mission,
                              :update_reward, :update_achievement, :update_mission, :grant,
                              :generate_reward_image, :destroy_reward_image ]

        # 定義を作る。**「配る」とは別**。
        #
        # ここで増えるのは「何があるか」であって、誰かの持ち物ではない。
        # 配るのは grant（手で配る）と、条件を満たしたときの自動付与。
        #
        # 鍵（key）は組み込みの定義と同じ名前空間に入る。既にある鍵と衝突すると
        # 組み込みの上書きになってしまうため、モデルの uniqueness で弾く。
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

        def create_reward
          definition = RewardDefinition.new(create_reward_params)
          save_definition(definition, kind: "reward", action: "reward_definition_create") do
            { reward: serialize_reward(definition) }
          end
        end

        def create_achievement
          definition = AchievementDefinition.new(create_achievement_params)
          save_definition(definition, kind: "achievement", action: "achievement_definition_create") do
            { achievement: serialize_achievement(definition) }
          end
        end

        def create_mission
          definition = MissionDefinition.new(create_mission_params)
          save_definition(definition, kind: "mission", action: "mission_definition_create") do
            { mission: serialize_mission(definition) }
          end
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

        # 獲得物の絵を作る。
        #
        # 仕組みは既にある（`Achievements::ImageGenerator`。これまで rake からしか
        # 呼べなかった）。**作った獲得物に、その場で絵を付けられる**ようにする。
        #
        # 待ち時間が出るので、押した人には「作っている」ことが分かる応答を返す。
        # 失敗しても定義そのものは壊さない（絵が無いだけで、既定の絵柄で出る）。
        def generate_reward_image
          definition = RewardDefinition.find(params[:id])

          ::Achievements::ImageGenerator.call(reward: definition, user_id: current_user.id)
          audit!("reward_image_generate", target: definition, details: { key: definition.key })
          render json: { reward: serialize_reward(definition.reload) }
        rescue StandardError => e
          Rails.logger.error "[RewardImage] FAILED key=#{definition&.key} #{e.class}: #{e.message}"
          render json: { errors: [ "絵を作れませんでした（#{e.class}）" ] }, status: :unprocessable_entity
        end

        # 絵を外す。定義は残す（絵が無ければ、種別ごとの既定の絵柄で出る）
        def destroy_reward_image
          definition = RewardDefinition.find(params[:id])
          definition.image.purge if definition.image.attached?
          definition.update!(image_key: nil)
          audit!("reward_image_destroy", target: definition, details: { key: definition.key })

          render json: { reward: serialize_reward(definition.reload) }
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

        # 作る・記録する・返すが3つとも同じ形なので、ここでまとめる。
        # 失敗したときに何も記録しないのも共通（作られていない定義の作成ログは残さない）
        def save_definition(definition, kind:, action:)
          if definition.save
            audit!(action, target: definition, details: { key: definition.key, name: definition.name })
            render json: yield, status: :created
          else
            render json: { errors: definition.errors.full_messages }, status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotUnique
          # 鍵の一意性は DB の unique index でも守られている。
          # 二人が同時に同じ鍵で作ると、検証をすり抜けてここに来る。
          # **500 にはしない**（作れなかった理由は利用者側の入力なので、断り方も同じにする）
          render json: { errors: [ "その鍵は既に使われています（#{definition.key}）" ] },
                 status: :unprocessable_entity
        end

        def reward_params
          params.require(:reward).permit(:name, :description, :rarity_level, :category, :published, :image_key)
        end

        # 作るときだけ受け取れるもの（鍵と種別）を足す。
        # **後から変えられない**ようにしてある。鍵は既に配った持ち物が指しており、
        # 種別は既定値の出どころ（apply_kind_defaults）なので、途中で変えると
        # 手元にある獲得物の意味が変わってしまう
        def create_reward_params
          params.require(:reward)
                .permit(:key, :kind, :name, :description, :rarity_level, :category, :published,
                        :image_key, :enabled, :starts_at, :ends_at, :position)
        end

        def create_achievement_params
          params.require(:achievement)
                .permit(:key, :name, :description, :category, :condition_type, :condition_target,
                        :position, :enabled, :published, :starts_at, :ends_at,
                        rewards: [ :type, :key, :amount ])
        end

        def create_mission_params
          params.require(:mission)
                .permit(:key, :name, :description, :cadence, :condition_type, :condition_target,
                        :position, :enabled, :published, :starts_at, :ends_at,
                        :mission_series_id, :series_step,
                        rewards: [ :type, :key, :amount ])
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
            image_path: definition.image_path,
            # 絵を確かめられるように、そのまま開ける形でも返す。
            # 組み立て方は利用者側（Presenter）と同じものを使う（食い違わせない）
            image_url: ::Achievements::Presenter.image_url_for(definition),
            builtin: definition.builtin?,
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
