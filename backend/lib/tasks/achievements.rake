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
