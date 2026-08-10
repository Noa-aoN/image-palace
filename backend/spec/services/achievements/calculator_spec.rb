require "rails_helper"

RSpec.describe Achievements::Calculator do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user) }

  def review!(at:, result: "correct")
    ItemReview.create!(user: user, item: item, mode: "quiz", result: result, reviewed_at: at)
  end

  def category(result, key)
    result[:categories].find { |row| row[:key] == key }
  end

  describe "メダル" do
    it "何もしていなければメダルは付かない" do
      result = described_class.call(user: user)

      expect(category(result, "cards")[:medal]).to be_nil
      expect(category(result, "cards")[:next_at]).to eq(1)
    end

    it "数に応じて段階が上がる" do
      create_list(:item, 1, user: user)
      expect(category(described_class.call(user: user), "cards")[:medal]).to eq("bronze")

      create_list(:item, 49, user: user)
      expect(category(described_class.call(user: user), "cards")[:medal]).to eq("silver")
    end

    # 金まで行った部門に「次」を出すと、永遠に終わらないように見える
    it "金に届いたら次の目標は出さない" do
      create_list(:item, 300, user: user)

      row = category(described_class.call(user: user), "cards")

      expect(row[:medal]).to eq("gold")
      expect(row[:next_at]).to be_nil
      expect(row[:remaining]).to be_nil
    end
  end

  describe "続けた日数" do
    it "連続している日を数える" do
      now = Time.zone.parse("2026-08-10 12:00")
      review!(at: now)
      review!(at: now - 1.day)
      review!(at: now - 2.days)

      expect(category(described_class.call(user: user, now: now), "streak")[:value]).to eq(3)
    end

    it "同じ日に何回やっても1日として数える" do
      now = Time.zone.parse("2026-08-10 12:00")
      3.times { review!(at: now) }

      expect(category(described_class.call(user: user, now: now), "streak")[:value]).to eq(1)
    end

    # その日の分を終える前に 0 に戻ると、続ける気を削ぐ
    it "今日まだやっていなくても、昨日までの連続は残る" do
      now = Time.zone.parse("2026-08-10 12:00")
      review!(at: now - 1.day)
      review!(at: now - 2.days)

      expect(category(described_class.call(user: user, now: now), "streak")[:value]).to eq(2)
    end

    it "2日以上空いたら途切れる" do
      now = Time.zone.parse("2026-08-10 12:00")
      review!(at: now - 3.days)

      expect(category(described_class.call(user: user, now: now), "streak")[:value]).to eq(0)
    end
  end

  describe "称号" do
    it "何もしていなければ見習い" do
      expect(described_class.call(user: user)[:current_title][:key]).to eq("novice")
    end

    # 誰でも取れるものにすると、いちばん上の印としての意味が無くなる
    it "月桂冠は全部門で金を取ったときだけ" do
      result = described_class.call(user: user)
      laureate = result[:titles].find { |t| t[:key] == "laureate" }

      expect(laureate[:earned]).to be(false)
      expect(laureate[:gold_required]).to eq(described_class::CATEGORIES.size)
    end

    it "金が1つで記憶の徒になる" do
      create_list(:item, 300, user: user)

      expect(described_class.call(user: user)[:current_title][:key]).to eq("apprentice")
    end
  end

  it "正解した回数は正解だけを数える" do
    now = Time.zone.parse("2026-08-10 12:00")
    review!(at: now, result: "correct")
    review!(at: now, result: "incorrect")
    review!(at: now, result: "seen")

    result = described_class.call(user: user, now: now)

    expect(category(result, "correct")[:value]).to eq(1)
    expect(category(result, "reviews")[:value]).to eq(3)
  end
end
