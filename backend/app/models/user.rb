class User < ApplicationRecord
  # == Deviseモジュール ======================================================
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable

  # == devise-token-auth設定 ================================================
  include DeviseTokenAuth::Concerns::User

  # == 関連付け ==============================================================
  has_one :setting, dependent: :destroy
  has_many :items, dependent: :destroy
  has_many :relations, dependent: :destroy
  has_many :shared_medias, dependent: :destroy
  has_many :subscriptions, dependent: :destroy
  has_one :active_subscription, -> { where(status: "active") }, class_name: "Subscription"
end
