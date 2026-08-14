require "rails_helper"

# 自分が作らせた絵を、ほかの人にも使わせてよいか。
#
# 同じ指示の絵は世界で1回しか作らないので、既定では
# 誰かが作った絵が、同じ指示を書いた次の人にもそのまま渡る。
# ふつうは得しかない（待ち時間ゼロ・原価ゼロ）が、
# **自分の言葉で書いた指示は、自分だけのものにしておきたい**こともある。
#
# 切るのは「出す側」だけ。取る側まで切ると、待ち時間も原価も跳ね上がるうえ、
# 得るものが無い（同じ絵がもう1枚できるだけ）。
RSpec.describe "作った絵を共有するか" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }

  describe "カードの絵" do
    def key_for(share:)
      user.create_setting!(share_generated_images: share)
      job = GenerateImageJob.new
      job.send(:shared_media_key, "光合成の情景", force_generate: false, user: user.reload)
    end

    it "既定では、指示そのものを鍵にする（ほかの人も使える）" do
      expect(key_for(share: true)).to eq("光合成の情景")
    end

    it "共有しない人のぶんは、その人だけの鍵で置く" do
      key = key_for(share: false)

      expect(key).to start_with("光合成の情景")
      expect(key).to include("private:#{user.id}")
    end

    it "設定がまだ無い人は、これまでどおり共有する" do
      job = GenerateImageJob.new

      expect(job.send(:shared_media_key, "光合成の情景", force_generate: false, user: user))
        .to eq("光合成の情景")
    end

    it "強制の作り直しは、共有の可否にかかわらず別の鍵になる" do
      user.create_setting!(share_generated_images: true)
      job = GenerateImageJob.new

      key = job.send(:shared_media_key, "光合成の情景", force_generate: true, user: user.reload)

      expect(key).to include("force:")
    end
  end

  describe "自由イメージ" do
    let!(:definition) do
      user.property_definitions.create!(item_type: item_type, key: "scene", label: "場面",
                                        value_type: "free_image")
    end
    let(:property) { item.item_properties.create!(property_definition: definition) }

    def write_key_for(share:)
      user.create_setting!(share_generated_images: share)
      GenerateFreeImageJob.new.send(:write_key, "葉のなか", user.reload)
    end

    it "既定では、ほかの人も使える鍵で置く" do
      expect(write_key_for(share: true)).to eq("free_image:葉のなか")
    end

    it "共有しない人のぶんは、その人だけの鍵で置く" do
      expect(write_key_for(share: false)).to include("private:#{user.id}")
    end

    it "取る側の鍵は変えない（ほかの人が作った絵は今までどおり使う）" do
      user.create_setting!(share_generated_images: false)

      expect(GenerateFreeImageJob.new.send(:cache_key, "葉のなか")).to eq("free_image:葉のなか")
    end

    it "共有しない人でも、既にある絵があれば作り直さない" do
      user.create_setting!(share_generated_images: false)
      shared = SharedMedia.create!(normalized_prompt: "free_image:葉のなか", metadata: {})
      shared.file.attach(io: StringIO.new("dummy"), filename: "a.webp", content_type: "image/webp")
      property.typed_value = { "heading" => "葉", "prompt" => "葉のなか" }
      property.save!

      expect(GenerateImageService).not_to receive(:call)
      GenerateFreeImageJob.perform_now(property.id, "葉のなか")

      expect(property.reload.typed_value["status"]).to eq("completed")
    end
  end
end
