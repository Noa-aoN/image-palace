require "rails_helper"

# 「何に使ったか」は AiUsage が持つ。
#
# 以前は消費の側にも種類を持たせていたが、記録が2か所に分かれると必ずずれる
# （実際、渡し忘れて文章の生成が「画像」として記録されていた）。
# 残高を引くのと、何に使ったかを残すのは別の仕事にする。
RSpec.describe Ai::UsageLimit, ".charge!" do
  let(:user) { create(:user, :confirmed) }

  before do
    user.credit_grants.create!(kind: "trial", amount_points: 100, remaining_points: 100,
                               expires_at: 30.days.from_now)
    user.reload
  end

  it "残高から引かれる" do
    described_class.charge!(user: user, kind: "meaning")

    expect(user.reload.available_credit_points).to eq(99)
  end

  it "運営でも同じように引かれる（財布は分けない）" do
    admin = create(:user, :confirmed, role: "admin")
    admin.draw_studio_allowance!(100, reason: "検証")

    described_class.charge!(user: admin.reload, kind: "meaning")

    expect(admin.reload.available_credit_points).to eq(99)
  end

  it "使う人がいなければ何もしない（0を返す）" do
    expect(described_class.charge!(user: nil, kind: "meaning")).to eq(0)
  end
end
