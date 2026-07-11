require "rails_helper"

RSpec.describe Notifications::CreateService, type: :service do
  let(:user) { create(:user, :confirmed) }

  def call(kind: "item_generation_completed", title: "「card」の画像生成が完了しました", **rest)
    described_class.call(user: user, kind: kind, title: title, **rest)
  end

  describe "新規作成" do
    it "通知を1件作り、count は 1 から始まる" do
      notification = call(url: "/items/abc", payload: { "item_id" => "abc" })

      expect(user.notifications.count).to eq(1)
      expect(notification.kind).to eq("item_generation_completed")
      expect(notification.url).to eq("/items/abc")
      expect(notification.payload["item_id"]).to eq("abc")
      expect(notification.payload["count"]).to eq(1)
      expect(notification).not_to be_read
    end
  end

  describe "まとめ（集約）" do
    it "直近10分以内の同種の未読があれば1件にまとめて件数を数える" do
      call
      call
      call

      expect(user.notifications.count).to eq(1)
      notification = user.notifications.first
      expect(notification.payload["count"]).to eq(3)
      expect(notification.title).to eq("カード3件の画像生成が完了しました")
    end

    it "既読の通知にはまとめず、新しい通知を作る" do
      create(:notification, :read, user: user, kind: "item_generation_completed")

      call

      expect(user.notifications.count).to eq(2)
      expect(user.notifications.unread.count).to eq(1)
    end

    it "10分より前の未読にはまとめず、新しい通知を作る" do
      create(:notification, user: user, kind: "item_generation_completed", created_at: 11.minutes.ago)

      call

      expect(user.notifications.count).to eq(2)
    end

    it "種別が違えばまとめない" do
      call(kind: "item_generation_completed")
      call(kind: "item_generation_failed", title: "「card」の画像生成に失敗しました")

      expect(user.notifications.count).to eq(2)
    end

    it "他ユーザーの通知にはまとめない" do
      other = create(:user, :confirmed)
      create(:notification, user: other, kind: "item_generation_completed")

      call

      expect(user.notifications.count).to eq(1)
      expect(other.notifications.count).to eq(1)
    end

    it "運営お知らせ（announcement）はまとめず1件ずつ残す" do
      call(kind: "announcement", title: "お知らせ1")
      call(kind: "announcement", title: "お知らせ2")

      expect(user.notifications.where(kind: "announcement").count).to eq(2)
    end
  end
end
