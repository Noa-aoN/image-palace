require "rails_helper"

RSpec.describe UserReward do
  let(:user) { create(:user) }
  let(:definition) { RewardDefinition.registry.find { |d| d.kind == "title" } }

  def owned
    described_class.create!(user: user, reward_definition: definition, source: "manual", quantity: 1)
  end

  describe "手放す・取り戻す" do
    it "手放しても行は残り、持っていない扱いになる" do
      reward = owned
      reward.revoke!

      expect(described_class.held.where(user_id: user.id)).to be_empty
      expect(described_class.revoked.where(user_id: user.id)).to contain_exactly(reward)
      expect(reward.reload.held?).to be(false)
    end

    # 持っていないものが宮殿に並んだままにならないこと
    it "手放すと、飾りも降りる" do
      reward = owned
      reward.update!(equipped: true, room_placed: true, featured_at: Time.current)
      reward.revoke!

      expect(reward.reload).to have_attributes(equipped: false, room_placed: false, featured_at: nil)
    end

    it "取り戻しても、初めて手にした日は変わらない" do
      reward = nil
      travel_to(1.year.ago) { reward = owned }
      first = reward.first_acquired_at

      reward.revoke!
      reward.restore!

      expect(reward.reload.held?).to be(true)
      expect(reward.first_acquired_at).to be_within(1.second).of(first)
      expect(reward.last_acquired_at).to be > first
    end

    # 何度呼ばれても、持っている状態は1回ぶんしか動かない
    it "二重に手放さない・二重に取り戻さない" do
      reward = owned

      expect(reward.revoke!).to be_truthy
      expect(reward.revoke!).to be(false)
      expect(reward.restore!).to be_truthy
      expect(reward.restore!).to be(false)
    end
  end

  describe "所持判定" do
    # revoked_at を足した目的。素の where で引くと手放したものが混ざる
    it "held は手放したものを含まない" do
      held = owned
      other = described_class.create!(
        user: user, reward_definition: RewardDefinition.registry.find { |d| d.kind == "medal" },
        source: "manual", quantity: 1
      )
      other.revoke!

      expect(described_class.held.where(user_id: user.id)).to contain_exactly(held)
    end
  end
end
