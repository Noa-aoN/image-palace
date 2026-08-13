require "rails_helper"

# なぜその段階なのか、の一言。
#
# **「使えない」だけが伝わるのが、いちばん困る。** 壊れているのか、これから来るのかが
# 分からないと、待ってよいのかも判断できない。
# 試作でも同じで、「粗い」とだけ伝わっても、どこが粗いのかが分からない。
RSpec.describe "段階の一言" do
  it "運営が書いたものだけを返す" do
    FeatureFlag.create!(key: "page.agora", stage: "development", notes: "共有の形をまだ決めている最中です")

    expect(FeatureFlag.public_notes["page.agora"]).to eq("共有の形をまだ決めている最中です")
  end

  it "書いていなければ返さない（空の行を作らない）" do
    FeatureFlag.create!(key: "page.agora", stage: "development", notes: "")

    expect(FeatureFlag.public_notes).not_to have_key("page.agora")
  end

  it "試作の段階でも持てる" do
    FeatureFlag.create!(key: "page.study_game", stage: "prototype", notes: "採点の重み付けを調整中です")

    expect(FeatureFlag.public_notes["page.study_game"]).to eq("採点の重み付けを調整中です")
    expect(FeatureFlag.stages["page.study_game"]).to eq("prototype")
  end

  it "知らない鍵はそもそも作れない（届かない場所の説明が残らない）" do
    row = FeatureFlag.new(key: "page.知らないもの", stage: "development", notes: "x")

    expect(row).not_to be_valid
  end
end
