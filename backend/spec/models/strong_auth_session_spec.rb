require "rails_helper"

# 強い確認を通ったのは「その人」ではなく「**いま使っているこの端末**」。
# ここが利用者単位になっていると、机のパソコンで確かめた結果が、
# 置き忘れた携帯にも効いてしまう。
RSpec.describe StrongAuthSession, type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "記録する" do
    it "端末ごとに残る" do
      described_class.record!(user: user, client_id: "机のパソコン", method: "passkey")

      expect(described_class.fresh?(user: user, client_id: "机のパソコン")).to be(true)
    end

    # ここが要。片方で確かめても、もう片方には効かない
    it "別の端末には効かない" do
      described_class.record!(user: user, client_id: "机のパソコン", method: "passkey")

      expect(described_class.fresh?(user: user, client_id: "携帯")).to be(false)
    end

    it "別の利用者にも効かない" do
      described_class.record!(user: user, client_id: "共有の端末", method: "totp")
      other = create(:user, :confirmed)

      expect(described_class.fresh?(user: other, client_id: "共有の端末")).to be(false)
    end

    it "同じ端末で確かめ直すと上書きする（行を増やさない）" do
      described_class.record!(user: user, client_id: "机", method: "totp")

      expect { described_class.record!(user: user, client_id: "机", method: "passkey") }
        .not_to change(described_class, :count)

      expect(described_class.find_by(user: user, client_id: "机").method).to eq("passkey")
    end

    # 端末が分からなければ、どの端末が通ったのか決められない
    it "端末の目印が無ければ記録しない" do
      expect(described_class.record!(user: user, client_id: nil, method: "totp")).to be_nil
      expect(described_class.count).to eq(0)
    end
  end

  describe "猶予" do
    it "通した直後は有効" do
      described_class.record!(user: user, client_id: "机", method: "passkey")

      expect(described_class.fresh?(user: user, client_id: "机")).to be(true)
    end

    # 長いと、席を外した隙に操作できてしまう
    it "猶予を過ぎたら切れる" do
      session = described_class.record!(user: user, client_id: "机", method: "passkey")
      session.update!(authenticated_at: (described_class::WINDOW + 1.minute).ago)

      expect(described_class.fresh?(user: user, client_id: "机")).to be(false)
    end

    it "一度も通していなければ無効" do
      expect(described_class.fresh?(user: user, client_id: "机")).to be(false)
    end

    # 用途で窓の広さを分ける。**値そのものをここで固定する**
    # （伸ばすなら、どちらを伸ばすのかを意識して直させたい）
    describe "用途ごとの猶予" do
      it "危険操作は10分、執務室は1時間" do
        expect(described_class::WINDOW).to eq(10.minutes)
        expect(described_class::ADMIN_WINDOW).to eq(1.hour)
      end

      it "10分を過ぎても、執務室の窓ではまだ有効" do
        session = described_class.record!(user: user, client_id: "机", method: "passkey")
        session.update!(authenticated_at: 20.minutes.ago)

        expect(described_class.fresh?(user: user, client_id: "机")).to be(false)
        expect(
          described_class.fresh?(user: user, client_id: "机", within: described_class::ADMIN_WINDOW)
        ).to be(true)
      end

      it "1時間を過ぎればどちらも切れる" do
        session = described_class.record!(user: user, client_id: "机", method: "passkey")
        session.update!(authenticated_at: 61.minutes.ago)

        expect(described_class.fresh?(user: user, client_id: "机")).to be(false)
        expect(
          described_class.fresh?(user: user, client_id: "机", within: described_class::ADMIN_WINDOW)
        ).to be(false)
      end
    end
  end

  describe "取り消し" do
    it "端末を指せば、その端末だけ消える" do
      described_class.record!(user: user, client_id: "机", method: "passkey")
      described_class.record!(user: user, client_id: "携帯", method: "totp")

      described_class.revoke!(user: user, client_id: "机")

      expect(described_class.fresh?(user: user, client_id: "机")).to be(false)
      expect(described_class.fresh?(user: user, client_id: "携帯")).to be(true)
    end

    it "指さなければ、その人の全部が消える" do
      described_class.record!(user: user, client_id: "机", method: "passkey")
      described_class.record!(user: user, client_id: "携帯", method: "totp")

      described_class.revoke!(user: user)

      expect(described_class.where(user: user).count).to eq(0)
    end
  end

  describe "掃除" do
    it "古いものを片付ける" do
      old = described_class.record!(user: user, client_id: "古い端末", method: "totp")
      old.update_columns(authenticated_at: 2.days.ago)
      described_class.record!(user: user, client_id: "いまの端末", method: "totp")

      described_class.sweep!

      expect(described_class.exists?(old.id)).to be(false)
      expect(described_class.where(user: user).count).to eq(1)
    end
  end
end
