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

  describe "表示の設定" do
    it "diagram_mode は 2d / 3d のみ有効" do
      expect(build(:setting, user: user, diagram_mode: "2d")).to be_valid
      expect(build(:setting, user: user, diagram_mode: "3d")).to be_valid
      expect(build(:setting, user: user, diagram_mode: "bogus")).not_to be_valid
    end

    it "motion_mode は auto / on / off のみ有効" do
      expect(build(:setting, user: user, motion_mode: "auto")).to be_valid
      expect(build(:setting, user: user, motion_mode: "off")).to be_valid
      expect(build(:setting, user: user, motion_mode: "bogus")).not_to be_valid
    end
  end

  describe "ライブラリの棚の並び順" do
    it "未設定なら既定の順になる" do
      setting = create(:setting, user: user)
      expect(setting.ordered_library_sections).to eq(Setting::LIBRARY_SECTIONS)
    end

    it "指定した順に並ぶ" do
      setting = create(:setting, user: user, library_order: %w[spaces cards])
      expect(setting.ordered_library_sections.first(2)).to eq(%w[spaces cards])
    end

    it "載っていない棚は末尾に回る（棚が画面から消えない）" do
      setting = create(:setting, user: user, library_order: %w[materials])
      expect(setting.ordered_library_sections).to eq(%w[materials cards canvas spaces boxes])
    end

    it "知らない名前は捨て、重複は畳む" do
      setting = create(:setting, user: user, library_order: %w[cards bogus cards])
      expect(setting.reload.library_order).to eq(Setting::LIBRARY_SECTIONS)
    end

    it "全て知らない名前なら既定の順に戻る" do
      setting = create(:setting, user: user, library_order: %w[bogus])
      expect(setting.ordered_library_sections).to eq(Setting::LIBRARY_SECTIONS)
    end
  end
end
