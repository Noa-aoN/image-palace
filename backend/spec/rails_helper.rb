# This file is copied to spec/ when you run 'rails generate rspec:install'
require 'spec_helper'
require_relative 'support/test_database_url'
# `||=` にしない。docker compose の web は RAILS_ENV=development を持っているので、
# それだと **テストが開発環境のまま走る**（host 制限やエラー表示が開発の設定になり、
# request spec が HTML のエラーページを受け取る）。テストは test 環境と決め切る。
ENV['RAILS_ENV'] = 'test'

# テストは必ずテスト専用の DB を使う。
# DATABASE_URL が入っている環境（docker compose）では、それが database.yml の
# test: の url を上書きしてしまい、開発 DB の上でテストが走る。
# 開発 DB の上で走ると、既存データを数えてしまう spec が理由もなく落ちるし、
# 消す系の spec は手元のデータを本当に消す。ここで行き先を決め切る。
ENV['DATABASE_URL'] = TestDatabaseUrl.resolve(
  ENV['TEST_DATABASE_URL'], ENV['DATABASE_URL']
)

# 外部 API の鍵は、**テストでは中身を使わないが「在ること」は要る**。
#
# 呼び出し側は ENV.fetch で取り出す（鍵の入れ忘れを本番で黙って通さないため）。
# fetch は引数を組み立てる時点で走るので、client を丸ごと差し替える spec でも、
# 鍵が無い環境では組み立ての段で落ちる。
#
# 手元の docker compose には本物が入っているので気づけない。**CI（本番イメージ）で
# 初めて落ちる**ので、ここで試験用の値を置いて、秘密に依存させない。
# 実際の通信は各 spec が差し替えているので、この値が外に出ることはない
ENV['OPENAI_API_KEY'] ||= 'test-openai-key'

require_relative '../config/environment'
# Prevent database truncation if the environment is production
abort("The Rails environment is running in production mode!") if Rails.env.production?

# 環境と DB の両方を、走り出す前に確かめる。
abort("テストは test 環境でしか実行しません（いまは #{Rails.env}）") unless Rails.env.test?

# 万一 test 以外の DB につながっていたら、1件も走らせずに止める。
# 「気づかずに開発 DB を触っていた」を二度とやらないための栓。
connected_database = ActiveRecord::Base.connection_db_config.database.to_s
unless connected_database.end_with?('_test')
  abort(<<~MESSAGE)
    テストの接続先が「#{connected_database}」になっています。
    テスト専用 DB（末尾が _test）以外では実行しません。
    TEST_DATABASE_URL でテスト用の接続先を指定してください。
  MESSAGE
end
# Uncomment the line below in case you have `--require rails_helper` in the `.rspec` file
# that will avoid rails generators crashing because migrations haven't been run yet
# return unless Rails.env.test?
require 'rspec/rails'
# Add additional requires below this line. Rails is not loaded until this point!

# Requires supporting ruby files with custom matchers and macros, etc, in
# spec/support/ and its subdirectories. Files matching `spec/**/*_spec.rb` are
# run as spec files by default. This means that files in spec/support that end
# in _spec.rb will both be required and run as specs, causing the specs to be
# run twice. It is recommended that you do not name files matching this glob to
# end with _spec.rb. You can configure this pattern with the --pattern
# option on the command line or in ~/.rspec, .rspec or `.rspec-local`.
#
# spec/support 配下のヘルパを自動 require
Rails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }

# Checks for pending migrations and applies them before tests are run.
# If you are not using ActiveRecord, you can remove these lines.
begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end
RSpec.configure do |config|
  # Remove this line if you're not using ActiveRecord or ActiveRecord fixtures
  config.fixture_paths = [
    Rails.root.join('spec/fixtures')
  ]

  # If you're not using ActiveRecord, or you'd prefer not to run each of your
  # examples within a transaction, remove the following line or assign false
  # instead of true.
  config.use_transactional_fixtures = true

  # You can uncomment this line to turn off ActiveRecord support entirely.
  # config.use_active_record = false

  # RSpec Rails uses metadata to mix in different behaviours to your tests,
  # for example enabling you to call `get` and `post` in request specs. e.g.:
  #
  #     RSpec.describe UsersController, type: :request do
  #       # ...
  #     end
  #
  # The different available types are documented in the features, such as in
  # https://rspec.info/features/7-1/rspec-rails
  #
  # ファイル配置から spec の type を推論する（spec/models → type: :model など）
  config.infer_spec_type_from_file_location!

  # Filter lines from Rails gems in backtraces.
  config.filter_rails_from_backtrace!

  # スイート開始時に seed データ（ItemType / Plan）を投入する
  config.before(:suite) do
    Rails.application.load_seed
  end
  # arbitrary gems may also be filtered via:
  # config.filter_gems_from_backtrace("gem name")
end
