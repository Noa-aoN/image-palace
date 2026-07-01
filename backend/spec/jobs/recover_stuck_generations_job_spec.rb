require "rails_helper"

RSpec.describe RecoverStuckGenerationsJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) { create(:user, :confirmed) }

  # timestamps は create 時に現在時刻で上書きされるため、update_column で過去に倒す。
  def item_with_updated_at(updated_at, **attrs)
    item = create(:item, user: user, **attrs)
    item.update_column(:updated_at, updated_at)
    item
  end

  it "しきい値より古い pending/processing を GenerateImageJob で再エンキューする" do
    old = (described_class::STUCK_AFTER + 5.minutes).ago
    pending_item = item_with_updated_at(old, generation_status: "pending")
    processing_item = item_with_updated_at(old, generation_status: "processing")

    expect { described_class.perform_now }
      .to have_enqueued_job(GenerateImageJob).with(pending_item.id)
      .and have_enqueued_job(GenerateImageJob).with(processing_item.id)
  end

  it "force_generate を付けずに item_id だけで再エンキューする（キャッシュ優先でコストを抑える）" do
    old = (described_class::STUCK_AFTER + 5.minutes).ago
    stuck = item_with_updated_at(old, generation_status: "pending")

    described_class.perform_now

    enqueued = enqueued_jobs.find { |j| j[:job] == GenerateImageJob }
    expect(enqueued[:args]).to eq([ stuck.id ])
  end

  it "しきい値内の新しい pending/processing は対象外" do
    item_with_updated_at(1.minute.ago, generation_status: "pending")
    item_with_updated_at(1.minute.ago, generation_status: "processing")

    expect { described_class.perform_now }.not_to have_enqueued_job(GenerateImageJob)
  end

  it "completed / failed は対象外" do
    old = 1.hour.ago
    item_with_updated_at(old, generation_status: "completed")
    item_with_updated_at(old, generation_status: "failed")

    expect { described_class.perform_now }.not_to have_enqueued_job(GenerateImageJob)
  end

  it "再エンキュー件数を返す" do
    old = (described_class::STUCK_AFTER + 5.minutes).ago
    item_with_updated_at(old, generation_status: "pending")
    item_with_updated_at(old, generation_status: "processing")

    expect(described_class.perform_now).to eq(2)
  end
end
