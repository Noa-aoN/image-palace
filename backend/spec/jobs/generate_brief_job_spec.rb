require "rails_helper"

RSpec.describe GenerateBriefJob do
  include ActiveJob::TestHelper

  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user, title: "機会費用", brief_status: "pending") }

  let(:brief) do
    SharedBrief.create!(
      normalized_source: "機会費用\nv1",
      description: "ある選択で諦めた他の選択肢の価値。",
      subject_kind: "abstract",
      scene_prompt: "A person standing at a fork in a country road at dusk"
    )
  end

  it "説明文と情景プロンプトをカードに保存し、画像生成へ引き継ぐ" do
    allow(Images::BriefResolver).to receive(:call).and_return(brief)

    expect { described_class.perform_now(item.id) }
      .to have_enqueued_job(GenerateImageJob).with(item.id, force_generate: false, use_meaning: false)

    item.reload
    expect(item.image_description).to include("諦めた")
    expect(item.scene_prompt).to include("fork in a country road")
    expect(item.brief_status).to eq("completed")
  end

  it "失敗しても画像生成へは進む（従来どおり単語から作られる）" do
    allow(Images::BriefResolver).to receive(:call).and_raise(Images::BriefService::GenerationError, "boom")

    expect { described_class.perform_now(item.id) }.to have_enqueued_job(GenerateImageJob)

    item.reload
    expect(item.brief_status).to eq("failed")
    expect(item.scene_prompt).to be_nil
  end

  it "機能が無効なら情景を作らず、そのまま画像生成へ進む" do
    allow(Images::BriefResolver).to receive(:call).and_return(nil)

    expect { described_class.perform_now(item.id) }.to have_enqueued_job(GenerateImageJob)

    item.reload
    expect(item.brief_status).to eq("none")
    expect(item.scene_prompt).to be_nil
  end

  it "ユーザーが手で直した情景は上書きしない" do
    item.update!(scene_prompt: "my own scene", brief_edited_at: Time.current, brief_status: "completed")
    allow(Images::BriefResolver).to receive(:call)

    expect { described_class.perform_now(item.id) }.to have_enqueued_job(GenerateImageJob)

    expect(Images::BriefResolver).not_to have_received(:call)
    expect(item.reload.scene_prompt).to eq("my own scene")
  end

  it "再生成オプションはそのまま画像生成へ渡す" do
    allow(Images::BriefResolver).to receive(:call).and_return(brief)

    expect { described_class.perform_now(item.id, force_generate: true, use_meaning: true) }
      .to have_enqueued_job(GenerateImageJob).with(item.id, force_generate: true, use_meaning: true)
  end

  it "カードが消えていたら何もしない" do
    expect { described_class.perform_now(SecureRandom.uuid) }.not_to have_enqueued_job(GenerateImageJob)
  end
end
