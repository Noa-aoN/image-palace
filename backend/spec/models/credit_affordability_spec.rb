require "rails_helper"

# 「払えるか」の判断は1か所にする。
#
# 引く側（consume_credits!）は公式制作枠も見るのに、入口は残高しか見ていなかった。
# そのため「枠は 500cr 余っているのに、残高が 0 だから作れない」が起きていた。
RSpec.describe "支払いの可否" do
  let(:user) { create(:user, :confirmed) }

  def grant!(points)
    user.credit_grants.create!(kind: "trial", amount_points: points, remaining_points: points,
                               expires_at: 30.days.from_now)
    user.reload
  end

  describe "普通の利用者" do
    it "残高が足りれば払える" do
      grant!(300)

      expect(user.can_afford?(100)).to be true
    end

    it "残高が足りなければ払えない（枠を持たないため）" do
      grant!(50)

      expect(user.can_afford?(100)).to be false
    end

    it "使えば残高が減る。1点＝0.01クレジットまで動く" do
      grant!(300)

      user.consume_credits!(1)

      expect(user.reload.available_credits).to eq(2.99)
    end
  end

  # 運営でも、**ほかの利用者とまったく同じ道**で引かれる。
  # 予算は財布を分ける代わりに、執務室から残高へ入れる（draw_studio_allowance!）
  describe "運営" do
    let(:user) { create(:user, :confirmed, role: "admin") }

    it "残高が無ければ払えない（運営でも同じ）" do
      expect(user.available_credit_points).to eq(0)

      expect(user.can_afford?(100)).to be false
    end

    it "予算から入れれば払える" do
      user.draw_studio_allowance!(100, reason: "公式カードの作成")

      expect(user.reload.can_afford?(100)).to be true
    end

    it "使えば残高から減る（枠は動かない）" do
      user.draw_studio_allowance!(300, reason: "公式カードの作成")
      before_drawn = user.studio_allowance_used_points

      user.reload.consume_credits!(100)

      expect(user.reload.available_credit_points).to eq(200)
      expect(user.studio_allowance_used_points).to eq(before_drawn)
    end
  end
end
