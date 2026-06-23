# frozen_string_literal: true

# 課金まわりの名前空間。クレジットは内部的に「ポイント」で保持し、表示はクレジット単位。
module Billing
  # 1クレジット = POINTS_PER_CREDIT ポイント。半額・品質倍率などを整数で扱うための内部単位。
  POINTS_PER_CREDIT = 100
end
