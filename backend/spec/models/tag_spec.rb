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

  describe ".assign_defaults_to（デフォルトグループの seed）" do
    it "科学分類/NDC のプリセットグループを作成する" do
      Tag.assign_defaults_to(user)

      keys = user.tag_groups.where(is_default: true).pluck(:default_key)
      expect(keys).to contain_exactly("science", "ndc")
    end

    it "共有タグ（自然科学）を両グループのメンバーにする" do
      Tag.assign_defaults_to(user)

      science = user.tag_groups.find_by(default_key: "science")
      ndc = user.tag_groups.find_by(default_key: "ndc")
      expect(science.tags.pluck(:name)).to include("自然科学")
      expect(ndc.tags.pluck(:name)).to include("自然科学")
    end

    it "再実行してもグループ・メンバーを重複させない（冪等）" do
      Tag.assign_defaults_to(user)
      member_count = -> { TagGroupItem.joins(:tag_group).where(tag_groups: { user_id: user.id }).count }

      expect { Tag.assign_defaults_to(user) }.to change { user.tag_groups.count }.by(0)
      expect { Tag.assign_defaults_to(user) }.to change(&member_count).by(0)
    end

    it "ユーザーが改名した既定グループ名を再実行で上書きしない" do
      Tag.assign_defaults_to(user)
      group = user.tag_groups.find_by(default_key: "science")
      group.update!(name: "わたしの分類")

      Tag.assign_defaults_to(user)

      expect(group.reload.name).to eq("わたしの分類")
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
