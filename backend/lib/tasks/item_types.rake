# frozen_string_literal: true

namespace :item_types do
  # 種別の自動判定は、これから作るカードにしか効かない。
  # それまでに作られたカードは、選ぶ場所が無かったので全部「単語」で溜まっている。
  # これを1回流して、いまある種別に振り分ける。
  #
  # **重い処理は worker で流すこと。** app（Web）で回すと、
  # 利用者ぶんの AI 呼び出しが API と同じ機で走り、応答が止まる。
  #
  #   fly ssh console -a image-palace-api --select   # worker 機を選ぶ
  #   cd /app && dry_run=1 bundle exec rake item_types:backfill   # まず下見
  #   cd /app && bundle exec rake item_types:backfill
  #
  # limit=100 で件数を絞れる（まず少しだけ試したいとき）。
  #
  # 注意: **利用者が自分で「単語」を選んだカードと区別が付かない。**
  # 種別を選べる場所が詳細にしか無かったため、選んだ記録が残っていない。
  # 判定も迷ったときは term を返すので、選び直される見込みは低いが、
  # 完全ではない。dry_run で件数と内訳を見てから流すこと。
  desc "「単語」のままのカードに、種別を当てる。dry_run=1 で下見、limit=N で件数を絞る"
  task backfill: :environment do
    dry_run = ENV["dry_run"] == "1"
    limit = ENV["limit"].presence&.to_i

    term = ItemType.find_by(name: ItemType::DEFAULT_NAME)
    abort "既定の種別（#{ItemType::DEFAULT_NAME}）がありません。db:seed を先に流してください" if term.nil?

    scope = Item.where(item_type_id: term.id).order(:created_at)
    scope = scope.limit(limit) if limit
    total = scope.count

    # 1枚あたりの見込み。実際の請求はモデルと入力の長さで変わる
    unit_credits = ::Ai::UsageLimit::UNIT_COST_POINTS.fdiv(::Billing::POINTS_PER_CREDIT)
    puts "対象: #{total} 枚 / 見込み: 約 #{(total * unit_credits).round(2)} cr"
    puts "-" * 60

    if dry_run
      puts "※ 下見のみ。何も変えていません（実際に判定もしていません）"
      next
    end

    counts = Hash.new(0)
    done = 0

    # **全件を一度に読まない**。find_each が 1000 件ずつに切って進める
    scope.find_each(batch_size: 200) do |item|
      # 流している最中に人が直したかもしれない。都度見直す
      next if item.reload.item_type_id != term.id

      result = Cards::DetectItemTypeService.call(title: item.title, user: item.user)
      counts[result.item_type.label] += 1
      done += 1

      if result.item_type.id != term.id
        Item.where(id: item.id, item_type_id: term.id)
            .update_all(item_type_id: result.item_type.id, updated_at: Time.current)
      end

      puts "  #{done}/#{total}" if (done % 100).zero?
    rescue StandardError => e
      counts["失敗"] += 1
      puts "× item_id=#{item.id} #{e.class}: #{e.message}"
    end

    puts "-" * 60
    counts.sort_by { |_, count| -count }.each { |label, count| puts "#{label}: #{count} 枚" }
    puts "\n当てた: #{done} 枚 / 残り「単語」: #{Item.where(item_type_id: term.id).count} 枚"
  end
end
