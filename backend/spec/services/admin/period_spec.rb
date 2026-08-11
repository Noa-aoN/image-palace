require "rails_helper"

RSpec.describe Admin::Period do
  let(:now) { Time.zone.local(2026, 8, 11, 12, 0, 0) }

  describe "選び方" do
    it "直近◯日" do
      period = described_class.resolve("7d", now: now)

      expect(period.days).to eq(7)
      expect(period.label).to eq("直近7日")
      expect(period.to).to eq(now)
    end

    it "半年・1年も直近の並びで扱う" do
      expect(described_class.resolve("6m", now: now).label).to eq("直近半年")
      expect(described_class.resolve("1y", now: now).label).to eq("直近1年")
    end

    it "◯年◯月は、その月のまるごと" do
      period = described_class.resolve("2026-07", now: now)

      expect(period.from).to eq(Time.zone.local(2026, 7, 1))
      expect(period.to).to eq(Time.zone.local(2026, 8, 1))
      expect(period.label).to eq("2026年7月")
    end

    it "全期間は、いちばん古い記録から今まで" do
      create(:user, :confirmed, created_at: Time.zone.local(2026, 3, 1))

      period = described_class.resolve("all", now: now)

      expect(period.from).to eq(Time.zone.local(2026, 3, 1))
      expect(period.label).to eq("全期間")
    end

    it "記録が何も無くても、範囲が空にならない" do
      period = described_class.resolve("all", now: now)

      expect(period.days).to be > 0
    end

    it "知らない値は既定（直近30日）に丸める" do
      expect(described_class.resolve("いつか", now: now).key).to eq("30d")
      expect(described_class.resolve(nil, now: now).key).to eq("30d")
      # 月の形をしていても、桁が合わなければ受け付けない
      expect(described_class.resolve("26-7", now: now).key).to eq("30d")
    end
  end

  describe "絞り込みの範囲" do
    it "全期間は下限を置かない（それより古い記録を落とさない）" do
      period = described_class.resolve("all", now: now)

      expect(period.range.begin).to be_nil
      expect(period.range).to cover(Time.zone.local(2020, 1, 1))
    end

    it "直近・月ごとは、その範囲だけ" do
      period = described_class.resolve("2026-07", now: now)

      expect(period.range).to cover(Time.zone.local(2026, 7, 15))
      expect(period.range).not_to cover(Time.zone.local(2026, 8, 1))
    end

    it "既定は引数で変えられる（探しに来る面は全期間にする）" do
      expect(described_class.resolve(nil, now: now, default: described_class::ALL).key).to eq("all")
    end
  end

  describe "折れ線の点" do
    it "短い期間は1日1点" do
      expect(described_class.resolve("7d", now: now).bucket_days).to eq(1)
    end

    it "長い期間はまとめる（点が細かすぎると傾きが読めない）" do
      period = described_class.resolve("1y", now: now)

      expect(period.bucket_days).to be > 1
      expect((period.days.to_f / period.bucket_days).ceil).to be <= described_class::MAX_SERIES_POINTS
    end
  end

  describe ".options" do
    it "直近・月ごと・全期間を返す" do
      create(:user, :confirmed, created_at: Time.zone.local(2026, 6, 15))

      options = described_class.options(now: now)

      expect(options[:rolling].map { |o| o[:value] }).to eq(%w[7d 30d 90d 6m 1y])
      expect(options[:months].map { |o| o[:value] }).to eq(%w[2026-08 2026-07 2026-06])
      expect(options[:all][:value]).to eq("all")
    end
  end
end
