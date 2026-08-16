# frozen_string_literal: true

namespace :achievements do
  desc "獲得物の絵を作る（既にある絵は作り直さない）。dry_run=1 で下見だけ"
  task :generate_images, [ :limit ] => :environment do |_task, args|
    limit = (args[:limit].presence || 50).to_i
    dry_run = ENV["dry_run"] == "1"

    RewardDefinition.registry
    targets = RewardDefinition.ordered.reject { |r| r.image.attached? }.first(limit)

    # 1枚あたりの見込み。実際の請求はモデルと品質で変わる
    unit_usd = CostParameter.table.image_unit_usd(model: GenerateImageService.descriptor[:model])
    puts "作る対象: #{targets.size} 件 / 見込み: 約 $#{(targets.size * unit_usd).round(2)}"
    puts "-" * 60

    if dry_run
      targets.each { |r| puts "#{r.key}\n  #{Achievements::ImageGenerator.new(reward: r).build_prompt.lines.first.strip}" }
      puts "\n※ 下見のみ。何も作っていません"
      next
    end

    made = 0
    targets.each do |reward|
      Achievements::ImageGenerator.call(reward: reward)
      made += 1
      puts "✓ #{reward.key} #{reward.name}"
    rescue StandardError => e
      puts "× #{reward.key}: #{e.class}: #{e.message}"
    end

    puts "-" * 60
    puts "作れた: #{made} 件 / 残り: #{RewardDefinition.ordered.reject { |r| r.image.attached? }.size} 件"
  end

  # 位はこれから配り始めるので、いま居る人には誰にも付いていない。
  # これを1回流して、全員をいまの契約に合わせる。
  #
  # **重い処理は worker で流すこと。** app（Web）で回すと、
  # 全利用者ぶんの問い合わせが API と同じ機で走り、応答が止まる。
  #
  #   fly ssh console -a image-palace-api --select   # worker 機を選ぶ
  #   bundle exec rake achievements:backfill_plan_titles
  #
  # 何度流しても同じ結果になる（同期なので、既に合っている人には何もしない）
  desc "いま居る全員の位を、契約状態に合わせる。dry_run=1 で下見だけ"
  task backfill_plan_titles: :environment do
    dry_run = ENV["dry_run"] == "1"
    # 定義が入っていないと、引けずに何も配らないまま終わる
    RewardDefinition.registry

    total = User.count
    counts = Hash.new(0)
    done = 0

    # **全件を一度に読まない**。find_each が 1000 件ずつに切って進める
    User.find_each(batch_size: 200) do |user|
      tier = if dry_run
               Achievements::SyncPlanTitle.current_tier(user)
      else
               Achievements::SyncPlanTitle.call(user: user)
      end
      counts[tier] += 1
      done += 1
      puts "  #{done}/#{total}" if (done % 500).zero?
    rescue StandardError => e
      counts["失敗"] += 1
      puts "× user_id=#{user.id}: #{e.class}: #{e.message}"
    end

    puts "-" * 60
    counts.sort_by { |_, count| -count }.each { |tier, count| puts "#{tier}: #{count} 人" }
    puts dry_run ? "\n※ 下見のみ。何も変えていません" : "\n合わせた: #{done} 人"
  end

  desc "作った絵に使った指示を一覧する（作り直すときの手がかり）"
  task prompts: :environment do
    RewardDefinition.ordered.each do |reward|
      prompt = reward.metadata["image_prompt"]
      next if prompt.blank?

      puts "## #{reward.key} — #{reward.name}"
      puts "  model: #{reward.metadata["image_model"]} / #{reward.metadata["image_generated_at"]}"
      puts prompt.lines.map { |line| "  #{line}" }.join
      puts ""
    end
  end
end

namespace :plans do
  desc "プランの徽章を作る（既にあるものは作り直さない）。dry_run=1 で下見だけ"
  task generate_images: :environment do
    dry_run = ENV["dry_run"] == "1"
    targets = Plan.where(kind: "subscription", image_key: nil).order(:price_cents)

    unit_usd = CostParameter.table.image_unit_usd(model: GenerateImageService.descriptor[:model])
    puts "作る対象: #{targets.size} 件 / 見込み: 約 $#{(targets.size * unit_usd).round(2)}"
    puts "-" * 60

    if dry_run
      targets.each { |p| puts "#{p.tier}\n  #{Billing::PlanImageGenerator.new(plan: p).build_prompt.lines.first.strip}" }
      puts "\n※ 下見のみ。何も作っていません"
      next
    end

    targets.each do |plan|
      Billing::PlanImageGenerator.call(plan: plan)
      puts "✓ #{plan.tier} #{plan.name}"
    rescue StandardError => e
      puts "× #{plan.tier}: #{e.class}: #{e.message}"
    end
    puts "残り: #{Plan.where(kind: "subscription", image_key: nil).count} 件"
  end
end
