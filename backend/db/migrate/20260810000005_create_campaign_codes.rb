class CreateCampaignCodes < ActiveRecord::Migration[8.1]
  # 引き換えコード。運営が気軽に発行して、条件付きでクレジットを配れるようにする。
  #
  # これまでクレジットを配る手段は、登録時のお試しと毎月の無料枠しか無く、
  # 個別に配りたいときは DB を直接触るしかなかった。
  def change
    create_table :campaign_codes, id: :uuid do |t|
      # 大文字で持つ。利用者が小文字で打っても通したいが、
      # 大小違いの別コードが並ぶと運営側が取り違える
      t.string :code, null: false
      t.string :label, null: false
      t.string :reward_type, null: false, default: "credits"
      t.integer :amount, null: false, default: 0
      t.string :item_kind
      # 受け取れる期間。null は制限なし
      t.datetime :starts_at
      t.datetime :expires_at
      # 受け取れる総数。null は無制限
      t.integer :max_redemptions
      # 配ったクレジットの有効期限（日）。null なら通常の期限に従う
      t.integer :credit_valid_days
      t.boolean :enabled, null: false, default: true
      t.text :notes
      t.references :created_by, type: :uuid, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :campaign_codes, :code, unique: true

    create_table :campaign_redemptions, id: :uuid do |t|
      t.references :campaign_code, type: :uuid, null: false, foreign_key: true
      t.references :user, type: :uuid, null: false, foreign_key: true
      # 実際に配ったポイント（あとから条件を変えても、配った量は動かさない）
      t.integer :points, null: false, default: 0
      t.datetime :created_at, null: false
    end
    # 1人1回。競合したときに DB 側で弾く（アプリ側の確認だけでは同時押しを通す）
    add_index :campaign_redemptions, [ :campaign_code_id, :user_id ], unique: true
  end
end
