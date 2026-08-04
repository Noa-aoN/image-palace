# frozen_string_literal: true

# お試し枠を配った相手の記録。アカウントを消しても残す。
#
# 1アカウント1回にしても、退会して同じアドレスで登録し直せば何度でも受け取れる。
# アカウント側に印を持たせている限り、この穴は塞げない。
#
# 誰に配ったかを、アカウントとは別に覚えておく。
# 個人情報は持たない（ハッシュのみ）。突き合わせにしか使えず、元へは戻せない。
class CreateTrialGrantRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :trial_grant_records, id: :uuid do |t|
      # メールアドレスや外部アカウントの識別子を、鍵付きでハッシュ化したもの
      t.string :identifier_digest, null: false
      # email / oauth のどちらの識別子か（調査用。個人は特定できない）
      t.string :source, null: false
      t.datetime :created_at, null: false
    end

    add_index :trial_grant_records, :identifier_digest, unique: true
  end
end
