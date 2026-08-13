require "rails_helper"

# クレジットの寿命そのものを見張る。
# 長さは1か所（CreditExpiryPolicy）にしかないので、ここが唯一の関門になる。
RSpec.describe Billing::CreditExpiryPolicy do
  describe "約束している長さ" do
    it "正式公開初期は3ヶ月" do
      expect(described_class::LIFETIME).to eq(3.months)
      expect(described_class.months).to eq(3)
    end

    # 前払式支払手段は「6ヶ月以内に限り使えるもの」なら規制の適用除外に入りやすい。
    # ここを伸ばすと、規約の改定だけでは済まなくなる
    it "6ヶ月を超えない" do
      expect(described_class::LIFETIME).to be <= 6.months
    end

    it "1ヶ月より短くしない（受け取った月のうちに消えると、配った意味が無くなる）" do
      expect(described_class::LIFETIME).to be > 1.month
    end
  end

  describe "期限の出し方" do
    it "受け取った時刻から数える" do
      travel_to(Time.zone.local(2026, 8, 13, 12)) do
        expect(described_class.expires_at).to eq(Time.zone.local(2026, 11, 13, 12))
      end
    end

    it "渡した時刻からも数えられる（過去のぶんを積み直すとき）" do
      expect(described_class.expires_at(Time.zone.local(2026, 1, 31, 9)))
        .to eq(Time.zone.local(2026, 4, 30, 9))
    end

    it "月額の持ち越しは1ヶ月ぶん短い（受け取ってから数えて同じ長さになる）" do
      travel_to(Time.zone.local(2026, 8, 13, 12)) do
        expect(described_class.carryover_expires_at).to eq(Time.zone.local(2026, 10, 13, 12))
      end
    end
  end

  describe "売っているものと噛み合っているか" do
    # 期限内に使い切れない量を「まとめると安い」と言って売ると、割引が見せかけになる。
    # 3ヶ月にしたことで、いちばん大きい買い切り（1,000枚）は1日およそ11枚のペースが要る。
    # パックの規模そのものの見直しは値段に触るので、別の判断として切り出してある。
    it "いちばん大きい買い切りに要るペースを見張る" do
      largest = Billing::Catalog::TOPUPS.max_by { |row| row[:credits] }
      per_day = largest[:credits] / (described_class::LIFETIME / 1.day)

      expect(per_day).to be <= 12
    end
  end
end
