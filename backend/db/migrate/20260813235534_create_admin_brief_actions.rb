class CreateAdminBriefActions < ActiveRecord::Migration[8.0]
  def change
    # 「次にやること」1件。
    #
    # 見立て（admin_insights）とは**1対1ではない**。見立ては3件まで、
    # やることも3件までだが、AI は別々に書くので数も中身も対応しない。
    # 見立ての status を「終わったか」に流用すると、
    # **AI が何を言ったか**と**人が何をやったか**が混ざる。
    #
    # 大きな課題管理にはしない。Issue や PR は GitHub 側の話で、
    # ここが持つのは「言われたことを、やったかどうか」だけ。
    create_table :admin_brief_actions, id: :uuid do |t|
      t.references :admin_brief, null: false, foreign_key: true, type: :uuid
      # どの見立てから来たかが分かるときだけ結ぶ（いまは結ばない）
      t.references :admin_insight, foreign_key: true, type: :uuid, null: true, index: false
      t.text :title, null: false
      t.string :status, default: "open", null: false
      t.datetime :completed_at
      t.integer :position, default: 0, null: false
      t.timestamps
    end
    add_index :admin_brief_actions, [ :admin_brief_id, :position ]
    add_index :admin_brief_actions, :status
  end
end
