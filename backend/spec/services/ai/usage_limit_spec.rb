require "rails_helper"

RSpec.describe Ai::UsageLimit do
  describe ".cost_points" do
    # 「AI を使ったのに何も減っていない」を無くすため、文章生成も 1pt = 0.01cr を取る。
    # ここが 0 に戻ると、その種類だけ黙って無料に戻る
    it "画面から呼ばれる種類はすべて課金対象" do
      described_class::DEFAULT_COST_POINTS.each_key do |kind|
        expect(described_class.cost_points(kind)).to eq(1), "#{kind} が無料になっています"
      end
    end

    # 呼び出しを足して表への追加を忘れても、気づかないまま無料で回り続けないようにする
    it "表に無い種類も既定で課金する" do
      expect(described_class.cost_points("brand_new_kind")).to eq(1)
    end

    it "ENV で個別に上書きできる" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_COST_MEANING").and_return("5")

      expect(described_class.cost_points("meaning")).to eq(5)
    end

    # 無料に戻したいときの逃げ道。ENV に 0 を置けば止まる
    it "ENV に 0 を置けば無料にできる" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_COST_TAGS").and_return("0")

      expect(described_class.cost_points("tags")).to eq(0)
    end
  end

  describe ".charge!" do
    let(:user) { create(:user, :confirmed) }

    it "消費したポイントを返す" do
      user.ensure_current_period_credits!
      before_points = user.available_credit_points

      expect(described_class.charge!(user: user, kind: "meaning")).to eq(1)
      expect(user.reload.available_credit_points).to eq(before_points - 1)
    end

    it "利用者が分からない呼び出しは課金しない" do
      expect(described_class.charge!(user: nil, kind: "meaning")).to eq(0)
    end
  end

  describe ".ensure_enough_credits!" do
    let(:user) { create(:user, :confirmed) }

    it "残高が足りなければ呼び出す前に止める" do
      # 先に今期の付与を済ませてから空にする。順番が逆だと、残高確認の中で
      # 無料枠が付与されて足りてしまう
      user.ensure_current_period_credits!
      user.update!(subscription_credits: 0, topup_credits: 0)
      user.credit_grants.destroy_all

      expect {
        described_class.ensure_allowed!(user: user, kind: "meaning")
      }.to raise_error(Ai::Chat::LimitExceeded, /クレジット/)
    end
  end
end
