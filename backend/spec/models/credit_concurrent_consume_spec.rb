require "rails_helper"

# 同時に引かれても二重に引かれないことを、実際に2本走らせて確かめる。
#
# ここだけは例をトランザクションで包まない。包むと、別の接続からは
# 相手のデータが見えず「並行して同じ残高を引く」状況を作れない。
# そのぶん後片付けは自分でやる。
RSpec.describe "クレジットを同時に引いたとき" do
  self.use_transactional_tests = false

  let(:pt) { Billing::POINTS_PER_CREDIT }
  let!(:user) { create(:user, :confirmed) }

  after do
    User.where(id: user.id).destroy_all
  end

  it "残高10のとき、8を2本同時に引いても片方だけが通る" do
    user.grant_credits!(10 * pt, kind: "campaign", expires_at: 5.days.from_now)

    results = [ nil, nil ]
    start = Queue.new
    threads = 2.times.map do |i|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          start.pop
          begin
            User.find(user.id).consume_credits!(8 * pt)
            results[i] = :ok
          rescue User::InsufficientCredits
            results[i] = :insufficient
          end
        end
      end
    end
    2.times { start << :go }
    threads.each(&:join)

    expect(results).to contain_exactly(:ok, :insufficient)
    expect(user.reload.available_credit_points).to eq(2 * pt)
    expect(user.credit_transactions.where(kind: "consumption").count).to eq(1)
  end

  it "残高を分け合えるぶんには、2本とも通る" do
    user.grant_credits!(10 * pt, kind: "campaign", expires_at: 5.days.from_now)

    start = Queue.new
    threads = 2.times.map do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          start.pop
          User.find(user.id).consume_credits!(5 * pt)
        end
      end
    end
    2.times { start << :go }
    threads.each(&:join)

    expect(user.reload.available_credit_points).to eq(0)
    expect(user.available_credit_points).to be >= 0
    expect(user.credit_transactions.where(kind: "consumption").count).to eq(2)
  end
end
