# frozen_string_literal: true

class AddDisplayStyleToSettings < ActiveRecord::Migration[8.1]
  def change
    # 一覧の見せ方。simple=素のグリッド / palace=場に応じた器（棚・イーゼル・デスク）。
    # 既定は宮殿スタイル（本サービスの体験の中心のため）。
    add_column :settings, :display_style, :string, default: "palace", null: false
    # 初回アクセス時の確認を出したかどうか。出し直しを避けるため時刻で持つ。
    add_column :settings, :onboarded_at, :datetime
  end
end
