# frozen_string_literal: true

namespace :security do
  # 既知の認証情報を持つシードユーザーを無効化する。
  #
  #   bundle exec rails security:disable_seed_user
  #
  # db/seeds.rb のテストユーザーは認証情報がリポジトリに書かれているため、
  # 誤って本番に作られた場合はログインできない状態にする必要がある。
  # アカウントとデータは残したまま、認証情報をランダム値に置き換え、
  # 発行済みトークンを破棄して既存セッションも断つ。
  #
  # 生成した値は保存も表示もしない（復旧が必要ならパスワード再設定メールを使う）。
  desc "シードユーザー(test@example.com)の認証情報を無効化し、既存セッションを破棄する"
  task disable_seed_user: :environment do
    user = User.find_by(email: "test@example.com")

    if user.nil?
      puts "[security] 対象ユーザーは存在しません"
      next
    end

    secret = SecureRandom.urlsafe_base64(48)
    user.password = secret
    user.password_confirmation = secret
    user.tokens = {}
    user.save!

    puts "[security] 無効化しました id=#{user.id} tokens_cleared=#{user.reload.tokens.empty?}"
  end
end
