class CreateUserRewardGrants < ActiveRecord::Migration[8.1]
  # 獲得物を受け取った**1回ぶん**の記録。
  #
  # user_rewards が「いま何を持っているか」なのに対し、こちらは「いつ・なぜ受け取ったか」。
  # 宝物を複数持てるようにすると、**何個目がどの出来事で来たのか**が分からなくなるため、
  # 数量だけでは足りない。
  #
  # ## event_key が要
  #
  # 同じ出来事から2回配られるのを、ここで止める。
  #   - 実績・ミッション … 定義の鍵（1人1回しか達成しない）
  #   - 手で配る         … 理由＋時刻（運営が同じ理由で2回配るのは別の出来事）
  #
  # **「正しい複数付与」と「再送による二重付与」は、event_key が違うかどうかで分ける。**
  # 数量だけを見ていると、この2つは区別が付かない。
  #
  # 一意にできない配り方（将来のイベント配布など）は nil を許す。
  # nil は Postgres の unique index では重複と見なされないので、素通りする。
  def change
    create_table :user_reward_grants, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.references :reward_definition, null: false, foreign_key: true, type: :uuid
      t.datetime :granted_at, null: false
      t.string :source, null: false, default: "achievement"
      t.string :source_ref
      # 同じ出来事から2回配らないための鍵。nil なら重ねて配れる
      t.string :event_key

      t.timestamps
    end

    add_index :user_reward_grants, [ :user_id, :reward_definition_id, :granted_at ],
              name: "index_reward_grants_on_user_definition_granted"
    add_index :user_reward_grants, [ :user_id, :event_key ], unique: true,
              name: "index_reward_grants_on_user_and_event_key"
  end
end
