class CreateAiModels < ActiveRecord::Migration[8.1]
  # AI モデルの登録簿。
  #
  # これまでモデルの情報は3か所に散っていた。
  #   ・使えるかどうか  … コードの定数と環境変数
  #   ・原価            … cost_parameters
  #   ・消費クレジット  … Billing::CreditCost / Ai::UsageLimit の定数
  # そのため「1枚いくらで、いくら貰っていて、誰に見せているか」を
  # 一度に見る場所が無く、値を変えるのにデプロイが要った。
  #
  # 組み込みのモデルはコード側に定義があり、初回に行として取り込む。
  # 以後は行が正（運営が画面から変えられる）。
  def change
    create_table :ai_models, id: :uuid do |t|
      # 画面や API で指す名前。画像は選択キー、文章はモデル名と同じにする
      t.string :key, null: false
      # image / text
      t.string :kind, null: false
      t.string :provider, null: false
      # 実際に叩くモデル名
      t.string :model_id, null: false

      # 利用者に見せる名前と説明
      t.string :label, null: false
      t.text :description

      t.boolean :enabled, null: false, default: true
      # 利用者に選ばせるか（切ると運営だけが使える）
      t.boolean :visible, null: false, default: true
      # その種類の既定
      t.boolean :default_for_kind, null: false, default: false

      # 使ってよい用途（item / avatar / cover / point など）。空なら制限なし
      t.jsonb :purposes, null: false, default: []

      # 1回あたりの消費（ポイント）。null なら種類ごとの既定
      t.integer :credit_points
      # 原価。画像は USD/枚、文章は入力の USD/1Mトークン
      t.decimal :unit_cost_usd, precision: 10, scale: 6
      # 文章の出力側の原価（USD/1Mトークン）
      t.decimal :output_cost_usd, precision: 10, scale: 6

      # 1日に作ってよい回数。null なら制限なし
      t.integer :daily_limit

      # この環境変数が入っていないと使えない
      t.string :requires_env
      t.text :notes
      t.integer :position, null: false, default: 0

      t.timestamps
    end
    add_index :ai_models, :key, unique: true
    add_index :ai_models, [ :kind, :position ]
  end
end
