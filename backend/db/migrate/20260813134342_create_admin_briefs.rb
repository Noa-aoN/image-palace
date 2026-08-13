class CreateAdminBriefs < ActiveRecord::Migration[8.0]
  def change
    # AI がまとめた「いまの見立て」。
    #
    # 出したものを残すのは、先週何を言ったかが分からないと
    #   ・同じ指摘を毎週繰り返す
    #   ・やった結果どうなったかを後から確かめられない
    # ためで、生成のたびに文面が変わると判断の根拠として使えない。
    create_table :admin_briefs, id: :uuid do |t|
      t.references :generated_by, foreign_key: { to_table: :users }, type: :uuid, null: true, index: false
      t.string :period_key, null: false
      t.datetime :period_from, null: false
      t.datetime :period_to, null: false
      # AI へ渡した数字そのもの。**後から「何を見てそう言ったか」を辿るために残す**
      t.jsonb :facts, default: {}, null: false
      # 要点・気になる変化・いちばんの課題・次にやること
      t.jsonb :summary, default: {}, null: false
      # どこまで測れていたか（未計測を 0 と読み違えないための但し書き）
      t.jsonb :completeness, default: {}, null: false
      t.string :model, null: false
      t.integer :prompt_tokens, default: 0, null: false
      t.integer :completion_tokens, default: 0, null: false
      t.integer :cost_points, default: 0, null: false
      t.timestamps
    end
    add_index :admin_briefs, :created_at

    # 見立て1件。
    #
    # **AI が書いたものと、人が決めたことを分ける。**
    # 観察・根拠・確信度は生成時のまま動かさない（後から書き換えると、
    # 何を根拠にそう言ったのかが失われる）。
    # 読んだ・見送った・片づいた、は人の側の話なので後から変えてよい。
    create_table :admin_insights, id: :uuid do |t|
      t.references :admin_brief, null: false, foreign_key: true, type: :uuid
      t.integer :position, default: 0, null: false

      # ここから下は生成時のまま（動かさない）
      t.text :observation, null: false
      t.jsonb :evidence, default: [], null: false
      t.string :confidence, null: false
      t.string :impact, null: false
      t.string :urgency, null: false
      t.text :suggested_action, null: false

      # ここから下は人の側の状態（後から変わる）
      t.string :status, default: "open", null: false
      t.datetime :reviewed_at
      t.datetime :dismissed_at
      t.datetime :resolved_at
      # 将来、施策と結びつけるための場所（いまは使わない）
      t.uuid :linked_initiative_id

      t.timestamps
    end
    add_index :admin_insights, [ :admin_brief_id, :position ]
    add_index :admin_insights, :status
  end
end
