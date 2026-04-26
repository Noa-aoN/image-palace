RSpec.configure do |config|
  # スイート開始前に test 用 ActiveStorage の Disk ストレージをクリーンアップする。
  # ディレクトリ自体と .keep は残す（git 追跡対象なので削除しない）。
  config.before(:suite) do
    storage_dir = Rails.root.join("tmp/storage")
    next unless storage_dir.exist?

    storage_dir.each_child do |entry|
      next if entry.basename.to_s == ".keep"

      FileUtils.rm_rf(entry)
    end
  end
end
