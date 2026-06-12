require "rails_helper"

RSpec.describe GenerateMeaningJob, type: :job do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user, title: "光合成") }

  it "サービスを呼んで意味を生成する" do
    allow(GenerateMeaningService).to receive(:call)

    described_class.perform_now(item.id)

    expect(GenerateMeaningService).to have_received(:call).with(item: item)
  end

  it "生成に失敗してもジョブは例外を伝播させない（補助情報のため）" do
    allow(GenerateMeaningService).to receive(:call).and_raise(GenerateMeaningService::GenerationError, "失敗")

    expect { described_class.perform_now(item.id) }.not_to raise_error
  end

  it "存在しないアイテムでは何もしない" do
    expect(GenerateMeaningService).not_to receive(:call)

    described_class.perform_now(SecureRandom.uuid)
  end
end
