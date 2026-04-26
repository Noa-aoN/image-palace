RSpec.configure do |config|
  # スイート開始前に test 用 ActiveStorage の Disk ストレージをクリーンアップする
  config.before(:suite) do
    storage_dir = Rails.root.join("tmp/storage")
    FileUtils.rm_rf(storage_dir) if storage_dir.exist?
  end
end
