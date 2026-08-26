require "rails_helper"

# トークンの寿命はリクエストのたびに延びるので、使い続けている限り切れない。
# 「7日**使わなければ**入り直し」という意味しかなく、
# 置き忘れた端末や持ち出されたトークンには効かない。
#
# ここは別の物差しで、**始まってから何日経ったか**を見る。
RSpec.describe SessionLifetime do
  let(:user) { create(:user, :confirmed) }
  let(:client) { "device-1" }

  before { user.update!(tokens: { client => { "token" => "x", "expiry" => 1.day.from_now.to_i } }) }

  describe "始まった時刻" do
    # 既にログインしている人の記録は無い。「無い＝古い」と扱うと
    # デプロイした瞬間に全員が締め出される
    it "まだ知らない端末は、いま始まったことにする" do
      travel_to Time.zone.local(2026, 8, 27, 9, 0, 0) do
        expect(user.session_started_at(client)).to eq(Time.current)
        expect(user.reload.session_starts[client]).to be_present
      end
    end

    it "一度控えたら、次からは動かさない" do
      started = Time.zone.local(2026, 8, 1, 9, 0, 0)
      travel_to(started) { user.session_started_at(client) }

      travel_to(started + 3.days) do
        expect(user.session_started_at(client)).to be_within(1.second).of(started)
      end
    end

    it "端末が違えば、別に数える" do
      user.update!(tokens: user.tokens.merge("device-2" => { "token" => "y", "expiry" => 1.day.from_now.to_i }))
      travel_to(Time.zone.local(2026, 8, 1)) { user.session_started_at(client) }
      travel_to(Time.zone.local(2026, 8, 20)) { user.session_started_at("device-2") }

      expect(user.reload.session_starts.keys).to contain_exactly(client, "device-2")
    end

    # 使われなくなった端末の記録が、いつまでも残らないように
    it "トークンの無くなった端末の記録は落とす" do
      user.update!(session_starts: { "old-device" => 1.year.ago.iso8601 })

      user.session_started_at(client)

      expect(user.reload.session_starts.keys).to eq([ client ])
    end
  end

  describe "上限を過ぎたか" do
    it "始まったばかりなら過ぎていない" do
      expect(user.session_expired?(client)).to be(false)
    end

    it "上限を越えたら過ぎている" do
      travel_to(Time.zone.local(2026, 7, 1)) { user.session_started_at(client) }

      travel_to(Time.zone.local(2026, 8, 15)) do
        expect(user.session_expired?(client)).to be(true)
      end
    end

    it "上限のすぐ手前では、まだ切らない" do
      started = Time.zone.local(2026, 8, 1, 12, 0, 0)
      travel_to(started) { user.session_started_at(client) }

      travel_to(started + SessionLifetime.max_days.days - 1.hour) do
        expect(user.session_expired?(client)).to be(false)
      end
    end

    # デプロイせずに切れるようにしておく
    it "0 を渡せば止まる" do
      travel_to(Time.zone.local(2026, 1, 1)) { user.session_started_at(client) }

      allow(SessionLifetime).to receive(:max_days).and_return(0)
      expect(SessionLifetime.enabled?).to be(false)
      expect(user.session_expired?(client)).to be(false)
    end

    it "端末が分からなければ切らない" do
      expect(user.session_expired?(nil)).to be(false)
      expect(user.session_expired?("")).to be(false)
    end
  end

  describe "締め出す" do
    it "トークンごと落とす" do
      user.session_started_at(client)

      user.end_session!(client)

      expect(user.reload.tokens).not_to have_key(client)
      expect(user.session_starts).not_to have_key(client)
    end

    # ほかの端末は巻き添えにしない
    it "ほかの端末は残る" do
      user.update!(tokens: user.tokens.merge("device-2" => { "token" => "y", "expiry" => 1.day.from_now.to_i }))
      user.session_started_at(client)
      user.session_started_at("device-2")

      user.end_session!(client)

      expect(user.reload.tokens.keys).to eq([ "device-2" ])
    end
  end
end
