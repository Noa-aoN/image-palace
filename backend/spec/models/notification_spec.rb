require "rails_helper"

RSpec.describe Notification, type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "バリデーション" do
    it "kind・title があれば有効" do
      expect(build(:notification, user: user)).to be_valid
    end

    it "kind が許可された種別以外なら無効" do
      notification = build(:notification, user: user, kind: "unknown_kind")

      expect(notification).not_to be_valid
      expect(notification.errors[:kind]).to be_present
    end

    it "title が無ければ無効" do
      expect(build(:notification, user: user, title: nil)).not_to be_valid
    end
  end

  describe "スコープ" do
    let!(:unread) { create(:notification, user: user, created_at: 1.hour.ago) }
    let!(:read) { create(:notification, :read, user: user, created_at: 2.hours.ago) }

    it "unread は未読だけを返す" do
      expect(user.notifications.unread).to contain_exactly(unread)
    end

    it "recent は新しい順に返す" do
      expect(user.notifications.recent.to_a).to eq([ unread, read ])
    end
  end

  describe "#mark_read!" do
    it "未読を既読にする" do
      notification = create(:notification, user: user)

      expect { notification.mark_read! }.to change { notification.reload.read? }.from(false).to(true)
    end

    it "既読の read_at は変えない" do
      notification = create(:notification, :read, user: user, read_at: 1.day.ago)

      expect { notification.mark_read! }.not_to change { notification.reload.read_at }
    end
  end

  describe "ユーザー削除" do
    it "ユーザーを消すと通知も消える" do
      create(:notification, user: user)

      expect { user.destroy! }.to change(described_class, :count).by(-1)
    end
  end
end
