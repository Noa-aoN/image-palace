require "rails_helper"

RSpec.describe SharedMedia, type: :model do
  describe "validations" do
    it "requires normalized_prompt" do
      sm = build(:shared_media, normalized_prompt: nil)
      expect(sm).to be_invalid
      expect(sm.errors[:normalized_prompt]).to include("can't be blank")
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:user).optional }
  end

  describe "ActiveStorage attachment" do
    it "supports attaching a file" do
      sm = create(:shared_media, :with_file)
      expect(sm.file).to be_attached
    end
  end

  describe ".for_prompt scope" do
    let(:user) { create(:user, :confirmed) }
    let(:prompt) { NormalizePromptService.call("for-prompt-test-#{SecureRandom.hex(4)}") }

    it "returns records matching the normalized_prompt ordered by created_at desc" do
      older = nil
      newer = nil
      freeze_time do
        older = create(:shared_media, user: user, normalized_prompt: prompt, created_at: 2.days.ago)
        newer = create(:shared_media, user: user, normalized_prompt: prompt, created_at: 1.day.ago)
      end

      expect(described_class.for_prompt(prompt).pluck(:id)).to eq([ newer.id, older.id ])
    end

    it "excludes records with different normalized_prompt" do
      target = create(:shared_media, user: user, normalized_prompt: prompt)
      _other = create(:shared_media, user: user, normalized_prompt: NormalizePromptService.call("other-prompt"))

      expect(described_class.for_prompt(prompt)).to contain_exactly(target)
    end
  end
end
