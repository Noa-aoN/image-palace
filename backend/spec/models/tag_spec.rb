require "rails_helper"

RSpec.describe Tag, type: :model do
  let(:user) { create(:user, :confirmed) }

  describe ".assign_defaults_to" do
    it "creates default tags with is_default and ordered position" do
      Tag.assign_defaults_to(user)

      expect(user.tags.count).to eq(Tag::DEFAULT_TAGS.size)
      expect(user.tags.where(is_default: true).count).to eq(Tag::DEFAULT_TAGS.size)
      # 先頭8個が指定順（position 1..8）
      first_eight = user.tags.where("position <= 8").order(:position).pluck(:name)
      expect(first_eight).to eq(%w[形式科学 自然科学 社会科学 人文科学 応用科学 芸術・創作 実用・生活 その他])
    end

    it "is idempotent (does not duplicate on re-run)" do
      Tag.assign_defaults_to(user)

      expect { Tag.assign_defaults_to(user) }.not_to change { user.tags.count }
    end

    it "marks an existing same-named tag as default without duplicating" do
      user.tags.create!(name: "自然科学")

      Tag.assign_defaults_to(user)

      tag = user.tags.where(name: "自然科学")
      expect(tag.count).to eq(1)
      expect(tag.first.is_default).to be(true)
      expect(tag.first.position).to eq(2)
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
