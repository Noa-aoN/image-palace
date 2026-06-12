# レート制限のカウンタはプロセス内の MemoryStore に蓄積されるため、
# テスト間で持ち越さないよう各 example の前にクリアする。
RSpec.configure do |config|
  config.before(:each) do
    Rack::Attack.cache.store.clear if defined?(Rack::Attack)
  end
end
