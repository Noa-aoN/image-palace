require "rails_helper"

RSpec.describe Wordlist, type: :model do
  let(:user) { create(:user, :confirmed) }

  it "name が必須" do
    expect(Wordlist.new(user: user, name: "")).not_to be_valid
  end

  it "name は 100 字以内" do
    expect(Wordlist.new(user: user, name: "あ" * 101)).not_to be_valid
  end

  it "words 配列を保存できる" do
    wl = user.wordlists.create!(name: "果物", words: %w[りんご バナナ])
    expect(wl.reload.words).to eq(%w[りんご バナナ])
  end
end
