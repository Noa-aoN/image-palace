require "rails_helper"

RSpec.describe Tag, type: :model do
  let(:user) { create(:user, :confirmed) }

  describe ".assign_defaults_to" do
    it "creates default tags (science5 + ndc, deduped) in order" do
      Tag.assign_defaults_to(user)

      expect(user.tags.where(is_default: true).count).to eq(Tag::DEFAULT_TAGS.size)
      first_five = user.tags.where("position <= 5").order(:position).pluck(:name)
      expect(first_five).to eq(%w[形式科学 自然科学 社会科学 人文科学 応用科学])
    end

    it "is idempotent (does not duplicate on re-run)" do
      Tag.assign_defaults_to(user)

      expect { Tag.assign_defaults_to(user) }.not_to change { user.tags.count }
    end

    it "demotes a former default tag no longer in the list to a normal tag" do
      stale = user.tags.create!(name: "実用・生活", is_default: true, position: 99)

      Tag.assign_defaults_to(user)

      expect(stale.reload.is_default).to be(false)
      expect(stale.position).to be_nil
    end
  end

  describe ".default_groups" do
    it "returns the groups a name belongs to (shared names belong to both)" do
      expect(Tag.default_groups("形式科学")).to eq(%w[main])
      expect(Tag.default_groups("自然科学")).to eq(%w[main ndc])
      expect(Tag.default_groups("総記")).to eq(%w[ndc])
      expect(Tag.default_groups("ユーザー作成タグ")).to eq([])
    end
  end

  describe ".ordered" do
    it "lists default tags first in position order, then others by name" do
      Tag.assign_defaults_to(user)
      user.tags.create!(name: "あ_ユーザータグ")

      names = user.tags.ordered.pluck(:name)
      expect(names.first).to eq("形式科学")
      expect(names.last).to eq("あ_ユーザータグ")
    end
  end
end
