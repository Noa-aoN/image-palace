class CreateAchievements < ActiveRecord::Migration[8.1]
  # アチーブメント（栄誉の間）の土台。
  #
  # 称号・勲章・褒賞・表彰は **1テーブル** にまとめる（kind で分ける）。
  # 列の9割が同じで、管理画面・ギャラリー・通知・付与の流れも同じ。
  # 分けると同じ画面を4つ作り、ギャラリーで4回 join することになる。
  #
  # 獲得や達成の履歴を持つ専用のログは作らない。
  # 利用者向けは notifications、運営の操作は admin_audit_logs、
  # 獲得の履歴は user_rewards.granted_at + source で足りる。
  def change
    # ── 獲得物の定義（称号・勲章・褒賞・表彰） ──
    create_table :reward_definitions, id: :uuid do |t|
      t.string :key, null: false
      t.string :kind, null: false
      t.string :name, null: false
      t.text :description
      t.string :rarity, null: false, default: "common"
      t.string :category

      t.boolean :enabled, null: false, default: true
      # 未公開のものは、獲得していない人には存在ごと見せない（不意打ち用）
      t.boolean :published, null: false, default: true
      t.integer :position, null: false, default: 0

      t.boolean :limited, null: false, default: false
      t.datetime :starts_at
      t.datetime :ends_at

      # どこに出せるか。既定は kind から決まるが、個別に変えられるようにしておく
      t.boolean :equippable, null: false, default: false
      t.boolean :featurable, null: false, default: false
      t.boolean :room_displayable, null: false, default: false
      t.boolean :profile_visible, null: false, default: true

      t.string :notify_title
      t.text :notify_body
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end
    add_index :reward_definitions, :key, unique: true
    add_index :reward_definitions, [ :kind, :position ]

    # ── 実績の定義 ──
    create_table :achievement_definitions, id: :uuid do |t|
      t.string :key, null: false
      t.string :name, null: false
      t.text :description
      t.string :category

      # 条件は Achievements::Conditions のレジストリを指す。
      # 知らない種類が来ても進捗0として扱い、画面は壊さない
      t.string :condition_type, null: false
      t.integer :condition_target, null: false, default: 1
      t.jsonb :condition_params, null: false, default: {}

      # 報酬。[{ "type" => "reward", "key" => ... }, { "type" => "credits", "amount" => 3 }]
      # 中間テーブルにすると、実績1つ作るのに2画面・2回の保存が要る
      t.jsonb :rewards, null: false, default: []

      t.boolean :enabled, null: false, default: true
      t.boolean :published, null: false, default: true
      t.integer :position, null: false, default: 0
      t.boolean :limited, null: false, default: false
      t.datetime :starts_at
      t.datetime :ends_at

      t.string :notify_title
      t.text :notify_body
      t.timestamps
    end
    add_index :achievement_definitions, :key, unique: true

    # ── ミッションの定義 ──
    create_table :mission_definitions, id: :uuid do |t|
      t.string :key, null: false
      t.string :name, null: false
      t.text :description
      # daily / weekly / onboarding / limited / event
      t.string :cadence, null: false, default: "onboarding"

      t.string :condition_type, null: false
      t.integer :condition_target, null: false, default: 1
      t.jsonb :condition_params, null: false, default: {}
      t.jsonb :rewards, null: false, default: []

      t.boolean :enabled, null: false, default: true
      t.boolean :published, null: false, default: true
      t.integer :position, null: false, default: 0
      t.datetime :starts_at
      t.datetime :ends_at

      t.string :notify_title
      t.text :notify_body
      t.timestamps
    end
    add_index :mission_definitions, :key, unique: true

    # ── 獲得物 ──
    create_table :user_rewards, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :reward_definition, type: :uuid, null: false, foreign_key: true
      t.datetime :granted_at, null: false
      # achievement / mission / manual / campaign
      t.string :source, null: false, default: "achievement"
      t.string :source_ref

      # 称号は1つだけ装備できる。勲章は数個まで掲げられる
      t.boolean :equipped, null: false, default: false
      t.datetime :featured_at
      t.boolean :room_placed, null: false, default: false
      t.timestamps
    end
    # 同じ獲得物は1人1つ。二重付与はここで止める
    add_index :user_rewards, [ :user_id, :reward_definition_id ], unique: true
    add_index :user_rewards, [ :user_id, :equipped ]

    # ── 実績の状態 ──
    create_table :user_achievements, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :achievement_definition, type: :uuid, null: false, foreign_key: true
      t.integer :progress, null: false, default: 0
      t.datetime :completed_at
      t.timestamps
    end
    add_index :user_achievements, [ :user_id, :achievement_definition_id ],
              unique: true, name: "index_user_achievements_unique"

    # ── ミッションの進捗 ──
    create_table :user_missions, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :mission_definition, type: :uuid, null: false, foreign_key: true
      # daily は "2026-08-10"、weekly は "2026-W33"、一度きりは "-"。
      # これを鍵に混ぜることで、繰り返しを「行が増える」だけで表せる
      # （毎日全ユーザーの行を作り直すリセット処理が要らない）
      t.string :period_key, null: false, default: "-"
      t.integer :progress, null: false, default: 0
      t.datetime :completed_at
      t.timestamps
    end
    add_index :user_missions, [ :user_id, :mission_definition_id, :period_key ],
              unique: true, name: "index_user_missions_unique"

    # ── 記録 ──
    #
    # これはキャッシュであって真実ではない。元データからいつでも数え直せる。
    # 保存するのは毎回数えると遅いからで、記録そのものをここに宿すためではない
    create_table :user_stats, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true, index: { unique: true }
      t.integer :cards_created, null: false, default: 0
      t.integer :images_generated, null: false, default: 0
      t.integer :containers_created, null: false, default: 0
      t.integer :reviews_total, null: false, default: 0
      t.integer :reviews_correct, null: false, default: 0
      t.integer :streak_days, null: false, default: 0
      t.integer :longest_streak, null: false, default: 0
      t.integer :active_days, null: false, default: 0
      t.integer :rewards_earned, null: false, default: 0
      t.integer :achievements_completed, null: false, default: 0
      t.datetime :computed_at
      t.timestamps
    end
  end
end
