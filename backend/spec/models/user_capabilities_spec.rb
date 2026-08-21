# frozen_string_literal: true

require "rails_helper"

# 誰に何ができるか。
#
# **表をそのまま書く。** 1マスでも変わったら落ちる。
# 役割を能力へ言い換えたときに、うっかり広げていないかを見るのが目的。
#
# 公式コンテンツの3つが admin だけなのは意図的。
# 招待の仕組みがまだ無い段階で operator へ開くと、
# 運営業務の担当者が公式コンテンツを触れることになり、職務が分かれない。
RSpec.describe UserCapabilities do
  # 縦が能力、横が役割。`◯` が持っている
  TABLE = <<~TEXT
                                  user support operator admin
    access_ops_room                 -     ◯       ◯       ◯
    support_users                   -     ◯       ◯       ◯
    view_analytics                  -     ◯       ◯       ◯
    operate_service                 -     -       ◯       ◯
    manage_billing                  -     -       -       ◯
    manage_members                  -     -       -       ◯
    manage_security                 -     -       -       ◯
    access_official_studio          -     -       -       ◯
    edit_official_content           -     -       -       ◯
    publish_official_content        -     -       -       ◯
  TEXT

  ROLES = %w[user support operator admin].freeze

  def expected
    rows = TABLE.lines.drop(1).map(&:split)
    rows.to_h { |name, *marks| [ name, ROLES.zip(marks.map { |m| m == "◯" }).to_h ] }
  end

  ROLES.each do |role|
    context "役割が #{role} のとき" do
      let(:user) { build(:user, role: role) }

      it "表のとおりの能力を持つ" do
        actual = UserCapabilities::CAPABILITIES.to_h { |c| [ c.to_s, user.capability?(c) ] }
        wanted = expected.transform_values { |by_role| by_role.fetch(role) }

        expect(actual).to eq(wanted)
      end
    end
  end

  it "表と能力の一覧が食い違っていない" do
    expect(expected.keys).to match_array(UserCapabilities::CAPABILITIES.map(&:to_s))
  end

  # 一般の人が、何かの拍子に持ってしまっていないか
  it "一般の人は何も持っていない" do
    expect(build(:user, role: "user").capabilities.values).to all(be(false))
  end

  # ENV の非常口を塞いでいないか。**ここが閉じると、締め出されたとき戻れない**
  it "環境変数で運営にした人は、全部持つ" do
    user = create(:user, :confirmed, email: "rescue-#{SecureRandom.hex(4)}@example.com", role: "user")
    allow(User).to receive(:bootstrap_admin_emails).and_return([ user.email ])

    expect(user.capabilities.values).to all(be(true))
  end

  # 原本を持つアカウントは、役割が user でも工房を使える。
  # **そのアカウントが既に全部を所有している**ので、公開の可否だけを分けても
  # 守れる範囲はさほど増えない。代わりに、入るときはもう一度本人か確かめる
  describe "原本を持つアカウント" do
    let(:owner) { create(:user, :confirmed, role: "user") }

    around do |example|
      original = ENV["OFFICIAL_CONTENT_USER_ID"]
      ENV["OFFICIAL_CONTENT_USER_ID"] = owner.id
      example.run
      ENV["OFFICIAL_CONTENT_USER_ID"] = original
    end

    it "役割が user でも、工房を使える" do
      expect(owner.can_access_official_studio?).to be(true)
      expect(owner.can_edit_official_content?).to be(true)
      expect(owner.can_publish_official_content?).to be(true)
    end

    # **運営の側は開かない。** 持ち主だからといって、人やお金は触れない
    it "運営の入口は開かない" do
      expect(owner.can_access_ops_room?).to be(false)
      expect(owner.can_manage_billing?).to be(false)
      expect(owner.can_manage_members?).to be(false)
    end

    it "ほかの一般の人には何も起きない" do
      expect(create(:user, :confirmed).capabilities.values).to all(be(false))
    end
  end

  describe "知らない名前" do
    it "問い合わせても false（例外にしない）" do
      expect(build(:user, role: "admin").capability?(:fly_to_the_moon)).to be(false)
    end
  end

  # 呼んでいる場所が既にあるので、言い換えとして残してある
  describe "既にある名前との関係" do
    it "can_manage_official_content? は、工房を使えるかと同じ" do
      %w[user support operator admin].each do |role|
        user = build(:user, role: role)
        expect(user.can_manage_official_content?).to eq(user.can_access_official_studio?)
      end
    end

    it "admin? は執務室に入れるかと同じ" do
      %w[user support operator admin].each do |role|
        user = build(:user, role: role)
        expect(user.admin?).to eq(user.can_access_ops_room?)
      end
    end

    it "owner? は、お金を触れるかと同じ" do
      %w[user support operator admin].each do |role|
        user = build(:user, role: role)
        expect(user.owner?).to eq(user.can_manage_billing?)
      end
    end
  end
end
