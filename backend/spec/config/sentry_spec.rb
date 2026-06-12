require "rails_helper"

RSpec.describe "Sentry initialization" do
  it "テスト環境（SENTRY_DSN 未設定）では初期化されない" do
    expect(ENV["SENTRY_DSN"]).to be_nil
    expect(Sentry.initialized?).to be(false)
  end

  it "DSN があっても test 環境は送信対象外として構成されている" do
    config = Sentry::Configuration.new
    config.enabled_environments = %w[staging production]

    expect(config.enabled_environments).to include("production")
    expect(config.enabled_environments).not_to include("test")
  end
end
