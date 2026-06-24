require "rails_helper"

RSpec.describe Tag, type: :model do
  let(:user) { create(:user, :confirmed) }

  describe ".assign_defaults_to" do
    it "creates the default tags with correct pinned flags" do
      Tag.assign_defaults_to(user)

      expect(user.tags.count).to eq(Tag::DEFAULT_TAGS.size)
      expect(user.tags.find_by(name: "自然科学").pinned).to be(true)
      expect(user.tags.find_by(name: "総記").pinned).to be(false)
    end

    it "is idempotent (does not duplicate on re-run)" do
      Tag.assign_defaults_to(user)

      expect { Tag.assign_defaults_to(user) }.not_to change { user.tags.count }
    end

    it "does not overwrite a same-named existing tag" do
      user.tags.create!(name: "自然科学", pinned: false)

      Tag.assign_defaults_to(user)

      expect(user.tags.where(name: "自然科学").count).to eq(1)
    end
  end
end
