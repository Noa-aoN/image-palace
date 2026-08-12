require "rails_helper"

# challenge は短命で1回きり。ここが緩むと、盗み見た応答をそのまま
# 送り直せてしまう（リプレイ）。
RSpec.describe WebauthnChallenge, type: :model do
  let(:user) { create(:user, :confirmed) }

  describe "発行" do
    it "用途と期限を持って作られる" do
      record = described_class.issue!(purpose: "registration", user: user)

      expect(record.challenge).to be_present
      expect(record.purpose).to eq("registration")
      expect(record.expires_at).to be > Time.current
      expect(record.consumed_at).to be_nil
    end

    it "毎回ちがう文字列になる" do
      first = described_class.issue!(purpose: "authentication")
      second = described_class.issue!(purpose: "authentication")

      expect(first.challenge).not_to eq(second.challenge)
    end

    # 認証の入口では、まだ誰か分からないことがある（passkey は端末が選ぶ）
    it "利用者が決まっていなくても作れる" do
      expect(described_class.issue!(purpose: "authentication").user).to be_nil
    end

    it "知らない用途は受け付けない" do
      expect { described_class.create!(challenge: "x", purpose: "unknown", expires_at: 1.minute.from_now) }
        .to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  describe "使う" do
    let!(:record) { described_class.issue!(purpose: "registration", user: user) }

    it "一度だけ通る" do
      expect(described_class.consume!(challenge: record.challenge, purpose: "registration", user: user)).to be_present
    end

    # 使い回せると、盗み見た応答をそのまま送り直せる
    it "二度目は通らない" do
      described_class.consume!(challenge: record.challenge, purpose: "registration", user: user)

      expect(described_class.consume!(challenge: record.challenge, purpose: "registration", user: user)).to be_nil
    end

    # 登録用を認証に使い回されないよう、用途で分ける
    it "用途がちがえば通らない" do
      expect(described_class.consume!(challenge: record.challenge, purpose: "authentication", user: user)).to be_nil
    end

    it "別の利用者では通らない" do
      other = create(:user, :confirmed)

      expect(described_class.consume!(challenge: record.challenge, purpose: "registration", user: other)).to be_nil
    end

    it "期限が切れていれば通らない" do
      record.update!(expires_at: 1.second.ago)

      expect(described_class.consume!(challenge: record.challenge, purpose: "registration", user: user)).to be_nil
    end

    it "知らない文字列では通らない" do
      expect(described_class.consume!(challenge: "でたらめ", purpose: "registration", user: user)).to be_nil
    end

    # 判定してから更新する書き方だと、同時に来た2つが両方とも
    # 「まだ使われていない」を見て、両方通ってしまう
    it "同時に2回来ても、成功するのは1つだけ" do
      results = []
      threads = 2.times.map do
        Thread.new do
          ActiveRecord::Base.connection_pool.with_connection do
            results << described_class.consume!(challenge: record.challenge, purpose: "registration", user: user)
          end
        end
      end
      threads.each(&:join)

      expect(results.compact.size).to eq(1)
    end
  end

  describe "掃除" do
    it "古い期限切れを片付ける" do
      old = described_class.issue!(purpose: "authentication")
      old.update_columns(expires_at: 2.days.ago)
      fresh = described_class.issue!(purpose: "authentication")

      described_class.sweep!

      expect(described_class.exists?(old.id)).to be(false)
      expect(described_class.exists?(fresh.id)).to be(true)
    end
  end
end
