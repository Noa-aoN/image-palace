require "rails_helper"

# 権限は、間違えると**自分が入れなくなる**種類の設定になる。
# 「入れる人が居なくなった」は本番で気づいても手遅れなので、ここで固定する。
RSpec.describe "利用者の役割", type: :model do
  describe "段階の順序" do
    it "上位は下位を含む" do
      operator = build(:user, role: "operator")

      expect(operator.at_least?("user")).to be(true)
      expect(operator.at_least?("support")).to be(true)
      expect(operator.at_least?("operator")).to be(true)
      expect(operator.at_least?("admin")).to be(false)
    end

    it "一般は運営の入口に入れない" do
      expect(build(:user, role: "user").admin?).to be(false)
    end

    it "support 以上は運営の入口に入れる" do
      %w[support operator admin].each do |role|
        expect(build(:user, role: role).admin?).to be(true)
      end
    end

    it "権限・お金を触れるのは admin だけ" do
      expect(build(:user, role: "operator").owner?).to be(false)
      expect(build(:user, role: "admin").owner?).to be(true)
    end
  end

  # ここが逃げ道。塞ぐと、いまの運営が権限を失ったときに戻せる人が居なくなる
  describe "ADMIN_EMAILS による逃げ道" do
    let(:user) { create(:user, :confirmed, email: "rescue@example.com", role: "user") }

    around do |example|
      original = ENV["ADMIN_EMAILS"]
      ENV["ADMIN_EMAILS"] = "rescue@example.com"
      example.run
      ENV["ADMIN_EMAILS"] = original
    end

    it "DB の役割が user でも admin として扱う" do
      expect(user.role).to eq("user")
      expect(user.effective_role).to eq("admin")
      expect(user.owner?).to be(true)
    end

    it "大文字小文字の違いは同じものとして扱う" do
      other = create(:user, :confirmed, email: "RESCUE@EXAMPLE.COM", role: "user")

      expect(other.bootstrap_admin?).to be(true)
    end

    # 未確認のうちから権限を持てると、アドレスを騙るだけで入れてしまう
    it "メール未確認では効かない" do
      unconfirmed = create(:user, email: "rescue@example.com", role: "user", confirmed_at: nil)

      expect(unconfirmed.bootstrap_admin?).to be(false)
      expect(unconfirmed.admin?).to be(false)
    end

    it "運営の一覧に数えられる（0人と出ない）" do
      user
      expect(User.effective_admins).to include(user)
    end
  end

  describe "最後の管理者を守る" do
    it "ほかに管理者が居なければ、その人は最後の管理者" do
      only = create(:user, :confirmed, role: "admin")

      expect(User.last_admin?(only)).to be(true)
    end

    it "ほかに管理者が居れば、最後ではない" do
      one = create(:user, :confirmed, role: "admin")
      create(:user, :confirmed, role: "admin")

      expect(User.last_admin?(one)).to be(false)
    end

    # operator が何人居ても、admin の代わりにはならない
    it "operator が居ても、最後の管理者であることは変わらない" do
      only = create(:user, :confirmed, role: "admin")
      create(:user, :confirmed, role: "operator")

      expect(User.last_admin?(only)).to be(true)
    end

    it "管理者でない人は対象外" do
      expect(User.last_admin?(create(:user, :confirmed, role: "operator"))).to be(false)
    end
  end
end
