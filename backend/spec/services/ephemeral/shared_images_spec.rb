# frozen_string_literal: true

require "rails_helper"

# 使い捨てのものを消す前に、分け合っている絵の紐だけ外す。
#
# **ここを間違えると、原本の絵が消える。**
# アカウントで区切ると、公式のアカウントが自分の荷物を下見したときに
# 原本の紐まで「他に持ち主が居る」ことになって外れてしまう。
# 消してよいのは、いま消そうとしているカードの紐だけ。
RSpec.describe Ephemeral::SharedImages, type: :service do
  let(:author) { create(:user, :confirmed) }
  let(:receiver) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  def make_item(user, title)
    item = user.items.create!(title: title, item_type: word, generation_status: "completed")
    item.medias.create!(media_type: "image", position: 0)
        .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png",
                     content_type: "image/png")
    item.meanings.create!(definition: "説明", language_code: "ja", position: 0)
    item
  end

  # 原本と、それを配った先。**同じ実体を分け合っている**
  let!(:original) { make_item(author, "DNS") }
  let!(:copy) do
    item = receiver.items.create!(title: "DNS", item_type: word, generation_status: "completed")
    media = item.medias.create!(media_type: "image", position: 0)
    media.file.attach(original.primary_media.file.blob)
    item
  end

  it "同じ実体を分け合っていることを、まず確かめる" do
    expect(copy.primary_media.file.blob.id).to eq(original.primary_media.file.blob.id)
    expect(ActiveStorage::Attachment.where(blob_id: original.primary_media.file.blob.id).count).to eq(2)
  end

  describe "分け合っている絵" do
    it "複製の紐だけ外れる" do
      expect(described_class.detach!([ copy.id ])).to eq(1)

      expect(copy.reload.primary_media.file.attached?).to be(false)
      expect(original.reload.primary_media.file.attached?).to be(true)
    end

    # **実体には触れない。** 外しているのは紐だけ
    it "実体は残る" do
      expect { described_class.detach!([ copy.id ]) }.not_to change(ActiveStorage::Blob, :count)
    end

    # ここが本題。**確かめる仕事を積まない**
    it "実体を消してよいか確かめる仕事が積まれない" do
      expect { described_class.detach!([ copy.id ]) }
        .not_to have_enqueued_job(ActiveStorage::PurgeJob)
    end
  end

  describe "そのカードだけが持っている絵" do
    let!(:lonely) { make_item(receiver, "ひとりぼっち") }

    it "外さない（普通に消えてよいもの）" do
      expect(described_class.detach!([ lonely.id ])).to eq(0)
      expect(lonely.reload.primary_media.file.attached?).to be(true)
    end
  end

  # **アカウントで区切ってはいけない。**
  # 公式のアカウントが自分の荷物を下見すると、複製と原本が同じアカウントに並ぶ
  describe "原本と複製が同じアカウントにあるとき" do
    let!(:same_owner_copy) do
      item = author.items.create!(title: "DNS（下見）", item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(original.primary_media.file.blob)
      item
    end

    it "指したカードの紐だけ外れ、原本は残る" do
      described_class.detach!([ same_owner_copy.id ])

      expect(same_owner_copy.reload.primary_media.file.attached?).to be(false)
      expect(original.reload.primary_media.file.attached?).to be(true)
    end

    # アカウントごと渡していたら、ここで原本の紐まで外れる
    it "原本を指せば原本が外れる（範囲の指定がそのまま効く）" do
      described_class.detach!([ original.id ])

      expect(original.reload.primary_media.file.attached?).to be(false)
      expect(same_owner_copy.reload.primary_media.file.attached?).to be(true)
    end
  end

  describe "何も無いとき" do
    it "空を渡しても落ちない" do
      expect(described_class.detach!([])).to eq(0)
    end
  end
end
