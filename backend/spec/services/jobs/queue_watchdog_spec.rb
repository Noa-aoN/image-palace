require "rails_helper"

RSpec.describe Jobs::QueueWatchdog do
  let(:now) { Time.current }

  # ワーカーは別マシンで動いているので、ワーカーの中から見張っても
  # ワーカーが死んだときに誰も気づけない。app 側から見る前提のサービス
  def with_worker(heartbeat_at:)
    SolidQueue::Process.create!(
      kind: "Worker", name: "test-worker", pid: 1, hostname: "test",
      last_heartbeat_at: heartbeat_at, metadata: {}
    )
  end

  # Job を作ると SolidQueue 側が ReadyExecution も用意する
  def enqueue_job
    SolidQueue::Job.create!(class_name: "GenerateImageJob", queue_name: "default", arguments: {})
  end

  describe ".status" do
    it "積まれていて心拍が新しければ、止まっていない" do
      enqueue_job
      with_worker(heartbeat_at: now)

      expect(described_class.status(now: now).stalled).to be(false)
    end

    # 2026-08-09 の障害。デプロイ後にワーカーが停止したまま戻らず、33件が滞留した
    it "積まれているのに心拍が古ければ、止まっていると判断する" do
      enqueue_job
      with_worker(heartbeat_at: now - 10.minutes)

      status = described_class.status(now: now)
      expect(status.stalled).to be(true)
      expect(status.ready).to eq(1)
    end

    it "ワーカーが1つも登録されていなければ、止まっていると判断する" do
      enqueue_job

      expect(described_class.status(now: now).stalled).to be(true)
    end

    # 何も積まれていないなら、ワーカーが止まっていても困らない
    it "積まれていなければ、止まっているとは言わない" do
      expect(described_class.status(now: now).stalled).to be(false)
    end
  end

  describe ".check!" do
    before { allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new) }

    it "止まっていれば知らせる" do
      enqueue_job
      expect(Sentry).to receive(:capture_message).with(/ワーカーが動いていません/, level: :error)

      described_class.check!(now: now)
    end

    it "止まっていなければ何もしない" do
      enqueue_job
      with_worker(heartbeat_at: now)
      expect(Sentry).not_to receive(:capture_message)

      described_class.check!(now: now)
    end

    # health は15秒ごとに叩かれる。毎回鳴らすと通知が埋まる
    it "続けて呼ばれても通知は間引く" do
      enqueue_job
      expect(Sentry).to receive(:capture_message).once

      3.times { described_class.check!(now: now) }
    end

    # health を壊さない。ワーカーが落ちても Web は提供できている
    it "監視自体が失敗しても例外を投げない" do
      allow(SolidQueue::Process).to receive(:maximum).and_raise(ActiveRecord::StatementInvalid, "boom")

      expect { described_class.check!(now: now) }.not_to raise_error
    end
  end
end
