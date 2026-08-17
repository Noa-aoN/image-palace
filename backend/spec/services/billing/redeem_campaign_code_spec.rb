# frozen_string_literal: true

require "rails_helper"

# 引き換えコードは、**配ってから間違いに気づく**種類の機能。
# 上限を超えて配ってしまっても、受け取った人から取り返せない。
#
# だから「外で1回見た」だけでは足りない。判定から書き込みまでの間に
# 期限が切れることも、別のリクエストが最後の1枠を取ることもある。
RSpec.describe Billing::RedeemCampaignCode do
  let(:user) { create(:user, :confirmed) }

  def make_code(**attrs)
    CampaignCode.create!({ code: "SPRING24", label: "春の配布", amount: 5 }.merge(attrs))
  end

  def redeem(as: user, now: Time.current)
    described_class.call(user: as, code: "SPRING24", now: now)
  end

  describe "受け取れない状態" do
    it "期限が切れていれば配らない" do
      code = make_code(expires_at: 1.hour.ago)

      expect { redeem }.to raise_error(described_class::Unavailable)
      expect(code.redemptions.count).to eq(0)
    end

    it "期限のちょうど手前なら配る" do
      make_code(expires_at: 1.hour.from_now)

      expect { redeem(now: 59.minutes.from_now) }.not_to raise_error
    end

    it "期限のちょうどに配らない（境目は切れている側に倒す）" do
      at = 1.hour.from_now
      make_code(expires_at: at)

      expect { redeem(now: at) }.to raise_error(described_class::Unavailable)
    end

    it "開始前なら配らない" do
      make_code(starts_at: 1.day.from_now)

      expect { redeem }.to raise_error(described_class::Unavailable)
    end

    it "止めてあれば配らない" do
      make_code(enabled: false)

      expect { redeem }.to raise_error(described_class::Unavailable)
    end

    it "使い切っていれば配らない" do
      code = make_code(max_redemptions: 1)
      code.redemptions.create!(user: create(:user, :confirmed), points: 500)

      expect { redeem }.to raise_error(described_class::Unavailable)
      expect(code.reload.redemptions.count).to eq(1)
    end
  end

  # 外の判定を通ったあと、書き込みまでの間に状態が変わる場合。
  # ロックの中でもう一度見ていなければ、ここをすり抜ける
  describe "判定と書き込みのあいだに状態が変わる" do
    def slipping_code(code)
      # 1回目（外の判定）は通し、2回目（ロックの中）は落とす
      allow(CampaignCode).to receive(:lookup).and_return(code)
      allow(code).to receive(:available?).and_return(true, false)
      code
    end

    it "途中で使えなくなったら、受け取りも付与もしない" do
      code = slipping_code(make_code)

      expect { redeem }.to raise_error(described_class::Unavailable)
      expect(code.redemptions.count).to eq(0)
      expect(user.credit_transactions.count).to eq(0)
    end

    it "ロックの中でも状態を見ている（外の1回では終わらない）" do
      code = slipping_code(make_code)

      begin
        redeem
      rescue described_class::Unavailable
        nil
      end

      expect(code).to have_received(:available?).twice
    end
  end

  describe "同じ人が2回押す" do
    it "2回目は受け取り済みとして断る" do
      make_code

      redeem
      expect { redeem }.to raise_error(described_class::AlreadyRedeemed)
      expect(user.credit_transactions.where(kind: "grant").count).to eq(1)
    end
  end

  # ここだけ本物の並行実行で確かめる。
  # **取引をまたいで見えないと、行ロックの効きが確かめられない**ので、
  # この塊だけ入れ子の取引を外し、後片付けを自分でする
  describe "同時に押される", :uses_real_transactions do
    self.use_transactional_tests = false

    let!(:rival) { create(:user, :confirmed) }

    after do
      CampaignRedemption.delete_all
      CampaignCode.delete_all
      CreditGrant.delete_all if defined?(CreditGrant)
      CreditTransaction.delete_all
      User.where(id: [ user.id, rival.id ]).delete_all
    end

    it "残り1枠に2人が同時に来ても、配るのは1人だけ" do
      code = make_code(max_redemptions: 1)
      results = Concurrent::Array.new

      threads = [ user, rival ].map do |who|
        Thread.new do
          ActiveRecord::Base.connection_pool.with_connection do
            described_class.call(user: who, code: "SPRING24")
            results << :ok
          rescue described_class::Error
            results << :rejected
          end
        end
      end
      threads.each(&:join)

      expect(results.count(:ok)).to eq(1)
      expect(results.count(:rejected)).to eq(1)
      expect(code.reload.redemptions.count).to eq(1)
      expect(CreditTransaction.where(kind: "grant").count).to eq(1)
    end

    it "同じ人が同時に2回押しても、1回しか配らない" do
      make_code
      results = Concurrent::Array.new

      threads = Array.new(2) do
        Thread.new do
          ActiveRecord::Base.connection_pool.with_connection do
            described_class.call(user: user, code: "SPRING24")
            results << :ok
          rescue described_class::Error
            results << :rejected
          end
        end
      end
      threads.each(&:join)

      expect(results.count(:ok)).to eq(1)
      expect(CreditTransaction.where(kind: "grant").count).to eq(1)
    end
  end
end
