require "rails_helper"

RSpec.describe Setting, type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "default_image_style のバリデーション" do
    it "許可されたスタイルなら有効" do
      expect(build(:setting, user: user, default_image_style: "photo")).to be_valid
    end

    it "空文字（おまかせ）なら有効" do
      expect(build(:setting, user: user, default_image_style: "")).to be_valid
    end

    it "未知の値なら無効" do
      expect(build(:setting, user: user, default_image_style: "bogus")).not_to be_valid
    end
  end
end
