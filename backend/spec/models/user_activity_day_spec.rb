require "rails_helper"

# 「誰が、どの日に活動したか」だけを残す。1人1日1行。
#
# 来訪の履歴は後から作れない。行を足すだけで、その日から測れるようにするための土台。
RSpec.describe UserActivityDay do
  let(:user) { create(:user, :confirmed) }
  let(:other) { create(:user, :confirmed) }

  describe "記録" do
    it "同じ日に何回来ても1行" do
      5.times { described_class.record!(user.id) }

      expect(described_class.where(user_id: user.id).count).to eq(1)
    end

    it "日が変われば新しい1行" do
      described_class.record!(user.id, Date.new(2026, 8, 12))
      described_class.record!(user.id, Date.new(2026, 8, 13))

      expect(described_class.where(user_id: user.id).pluck(:on_date))
        .to contain_exactly(Date.new(2026, 8, 12), Date.new(2026, 8, 13))
    end

    it "人が違えば別の行" do
      described_class.record!(user.id)
      described_class.record!(other.id)

      expect(described_class.count).to eq(2)
    end

    it "同時に来ても重複しない（一意の索引が弾く）" do
      # 同じ日・同じ人を2回入れても例外にならず、行は1つのまま
      expect {
        2.times { described_class.record!(user.id) }
      }.to change(described_class, :count).by(1)
    end
  end

  describe "利用者の入口から" do
    it "1日1回だけ書かれる（2回目は書き込みに来ない）" do
      expect { 3.times { user.touch_last_seen! } }.to change(described_class, :count).by(1)
    end

    it "ログインしていない人は記録しない" do
      # 入口は current_user があるときにしか呼ばれない。行は増えない
      expect { described_class.where(user_id: nil).count }.not_to raise_error
      expect(described_class.count).to eq(0)
    end
  end

  describe "退会" do
    it "行も一緒に消える（誰のものか分からない記録を残さない）" do
      described_class.record!(user.id)

      expect { user.destroy }.to change(described_class, :count).by(-1)
    end
  end

  # ここが動くと、同じ過去を見ているのに答えが変わる
  describe "測り始めた日" do
    it "記録が1件も無くても、決めた日を返す（誰も来なかったことも観測結果）" do
      expect(described_class.count).to eq(0)
      expect(described_class.measurement_started_on).to eq(described_class::MEASUREMENT_STARTED_ON)
    end

    it "最初の記録が何日後であっても動かない" do
      described_class.record!(user.id, described_class::MEASUREMENT_STARTED_ON + 10.days)

      expect(described_class.measurement_started_on).to eq(described_class::MEASUREMENT_STARTED_ON)
    end

    it "いちばん古い記録を消しても動かない" do
      described_class.record!(user.id, described_class::MEASUREMENT_STARTED_ON)
      described_class.record!(other.id, described_class::MEASUREMENT_STARTED_ON + 3.days)

      described_class.where(user_id: user.id).delete_all

      expect(described_class.measurement_started_on).to eq(described_class::MEASUREMENT_STARTED_ON)
    end

    it "いちばん古い記録を持つ人が退会しても動かない" do
      described_class.record!(user.id, described_class::MEASUREMENT_STARTED_ON)
      user.destroy

      expect(described_class.measurement_started_on).to eq(described_class::MEASUREMENT_STARTED_ON)
    end
  end

  describe "持つもの" do
    it "誰が・どの日か、以外を持たない" do
      expect(described_class.column_names).to contain_exactly("id", "user_id", "on_date", "created_at")
    end
  end
end
