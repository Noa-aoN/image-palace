RSpec.configure do |config|
  config.include ActiveSupport::Testing::TimeHelpers

  # ブロックを付けずに travel_to した例は、そのままだと次の例へ時刻を持ち越す。
  # （Minitest は teardown で自動的に戻すが、RSpec は戻さない）
  # 持ち越すと「並び順によってだけ落ちる」テストになるので、毎回ここで戻す。
  config.after { travel_back }
end
