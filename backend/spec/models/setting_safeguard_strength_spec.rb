require "rails_helper"

# 覆いの濃さ。**掛けるかどうか（image_safeguard）とは別の軸。**
#
# 「細部が読めない／構図は掴める」の境目は人によって違う。
# 不意打ちを避けたいだけの人には薄いほうがよく、
# 人前で開く人には色の気配すら残さないほうがよい。
RSpec.describe "覆いの濃さ" do
  let(:user) { create(:user, :confirmed) }
  let(:setting) { user.setting || user.create_setting! }

  # 既存の利用者の見え方を変えない
  it "既定は標準（いままでと同じ見え方）" do
    expect(setting.image_safeguard_strength).to eq("normal")
  end

  it "薄い・標準・濃いから選べる" do
    %w[light normal strong].each do |value|
      setting.image_safeguard_strength = value
      expect(setting).to be_valid
    end
  end

  it "知らない濃さは入らない" do
    setting.image_safeguard_strength = "とても濃い"
    expect(setting).not_to be_valid
  end

  # 画面と同じ並びを持つ（frontend の test/lib/safeguard.test.ts が同じ一覧を固定している）
  it "受け付ける濃さは、画面の一覧と同じ" do
    expect(Setting::IMAGE_SAFEGUARD_STRENGTHS).to eq(%w[light normal strong])
  end

  # 覆いを掛けるかどうかとは独立して持つ
  it "覆いを切っていても、濃さは保たれる" do
    setting.update!(image_safeguard: true, image_safeguard_strength: "strong")
    setting.update!(image_safeguard: false)

    expect(setting.reload.image_safeguard_strength).to eq("strong")
  end
end
