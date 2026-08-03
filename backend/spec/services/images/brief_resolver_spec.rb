require "rails_helper"

RSpec.describe Images::BriefResolver do
  let(:generated) do
    Images::BriefService::Result.new(
      description: "赤くて丸い果実",
      subject_kind: "concrete",
      scene_prompt: "a single red apple on a wooden table",
      model: "gpt-4o-mini"
    )
  end

  describe ".call" do
    it "初回は生成して SharedBrief に保存する" do
      allow(Images::BriefService).to receive(:call).and_return(generated)

      expect { described_class.call(title: "りんご") }.to change(SharedBrief, :count).by(1)

      brief = SharedBrief.last
      expect(brief.scene_prompt).to eq("a single red apple on a wooden table")
      expect(brief.subject_kind).to eq("concrete")
      expect(brief.metadata["model"]).to eq("gpt-4o-mini")
    end

    it "2回目は生成せずキャッシュを返す（同じ単語は世界で1回だけ作る）" do
      allow(Images::BriefService).to receive(:call).and_return(generated)
      described_class.call(title: "りんご")

      expect(Images::BriefService).to have_received(:call).once
      expect { described_class.call(title: "りんご") }.not_to change(SharedBrief, :count)
      expect(Images::BriefService).to have_received(:call).once
    end

    it "表記ゆれ（全角・大文字・前後空白）は同じキャッシュに寄せる" do
      allow(Images::BriefService).to receive(:call).and_return(generated)

      described_class.call(title: "Apple")
      described_class.call(title: "  ａｐｐｌｅ ")

      expect(SharedBrief.count).to eq(1)
    end

    it "IMAGE_BRIEF_ENABLED=false なら生成せず nil を返す（従来の挙動へ戻せる）" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("IMAGE_BRIEF_ENABLED", "true").and_return("false")
      allow(Images::BriefService).to receive(:call)

      expect(described_class.call(title: "りんご")).to be_nil
      expect(Images::BriefService).not_to have_received(:call)
    end

    it "単語が空なら生成せず nil を返す" do
      allow(Images::BriefService).to receive(:call)

      expect(described_class.call(title: "")).to be_nil
      expect(Images::BriefService).not_to have_received(:call)
    end

    it "同時に同じ単語が入っても、先に入った行を使う" do
      allow(Images::BriefService).to receive(:call).and_return(generated)
      # 別プロセスが一瞬先に同じ行を入れた状況を作る
      allow(SharedBrief).to receive(:create!) do |attributes|
        SharedBrief.new(attributes).save!
        raise ActiveRecord::RecordNotUnique, "duplicate key"
      end

      result = described_class.call(title: "りんご")

      expect(result).to be_a(SharedBrief)
      expect(result.scene_prompt).to eq("a single red apple on a wooden table")
      expect(SharedBrief.count).to eq(1)
    end
  end
end
