require "rails_helper"

RSpec.describe RecoverStuckGenerationsJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) { create(:user, :confirmed) }
  let(:old) { (described_class::STUCK_AFTER + 5.minutes).ago }

  # timestamps は create 時に現在時刻で上書きされるため、update_column で過去に倒す。
  def item_with_updated_at(updated_at, **attrs)
    item = create(:item, user: user, **attrs)
    item.update_column(:updated_at, updated_at)
    item
  end

  def point_with_updated_at(updated_at, **attrs)
    space = create(:space, :road, user: user)
    point = create(:space_point, space: space, **attrs)
    point.update_column(:updated_at, updated_at)
    point
  end

  describe "Item（画像生成）の復旧" do
    it "しきい値より古い pending/processing を GenerateImageJob で再エンキューする" do
      pending_item = item_with_updated_at(old, generation_status: "pending")
      processing_item = item_with_updated_at(old, generation_status: "processing")

      expect { described_class.perform_now }
        .to have_enqueued_job(GenerateImageJob).with(pending_item.id)
        .and have_enqueued_job(GenerateImageJob).with(processing_item.id)
    end

    it "force_generate を付けず item_id だけで再エンキューする（キャッシュ優先でコストを抑える）" do
      stuck = item_with_updated_at(old, generation_status: "pending")

      described_class.perform_now

      enqueued = enqueued_jobs.find { |j| j[:job] == GenerateImageJob }
      expect(enqueued[:args]).to eq([ stuck.id ])
    end

    it "しきい値内の新しい pending/processing は対象外" do
      item_with_updated_at(1.minute.ago, generation_status: "pending")
      expect { described_class.perform_now }.not_to have_enqueued_job(GenerateImageJob)
    end

    it "completed / failed は対象外" do
      item_with_updated_at(old, generation_status: "completed")
      item_with_updated_at(old, generation_status: "failed")
      expect { described_class.perform_now }.not_to have_enqueued_job(GenerateImageJob)
    end
  end

  describe "SpacePoint（ポイント画像生成）の復旧" do
    it "しきい値より古い named の pending/processing を GeneratePointImageJob で再エンキューする" do
      pending_point = point_with_updated_at(old, name: "灯台", generation_status: "pending")
      processing_point = point_with_updated_at(old, name: "羅針盤", generation_status: "processing")

      expect { described_class.perform_now }
        .to have_enqueued_job(GeneratePointImageJob).with(pending_point.id)
        .and have_enqueued_job(GeneratePointImageJob).with(processing_point.id)
    end

    it "名前の無い空ポイントは（生成対象外なので）再エンキューしない" do
      point_with_updated_at(old, name: nil, generation_status: "pending")
      point_with_updated_at(old, name: "", generation_status: "pending")

      expect { described_class.perform_now }.not_to have_enqueued_job(GeneratePointImageJob)
    end

    it "しきい値内・completed/failed は対象外" do
      point_with_updated_at(1.minute.ago, name: "新しい", generation_status: "pending")
      point_with_updated_at(old, name: "完了", generation_status: "completed")
      point_with_updated_at(old, name: "失敗", generation_status: "failed")

      expect { described_class.perform_now }.not_to have_enqueued_job(GeneratePointImageJob)
    end
  end

  it "再エンキュー総数（items + points）を返す" do
    item_with_updated_at(old, generation_status: "pending")
    point_with_updated_at(old, name: "灯台", generation_status: "processing")

    expect(described_class.perform_now).to eq(2)
  end
end
