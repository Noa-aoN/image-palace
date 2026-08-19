# frozen_string_literal: true

# 公式コンテンツを、手元と本番から扱うための入口。
#
# **ここには処理を書かない。** 中身はすべて `ContentPackages::*` にあり、
# rake は「どれを、どの名前で」を受け取って渡すだけ。
# いずれ公式工房の画面から同じものを呼ぶので、
# 処理がここに溜まると、そのとき2か所を直すことになる。
#
#   bin/rails content:list
#   bin/rails content:show KEY=starter_it
#   bin/rails content:publish KEY=starter_it KIND=starter NAME="ITのことば" BOXES=<id> VIEWS=<id>
#   bin/rails content:install KEY=starter_it EMAIL=someone@example.com
namespace :content do
  desc "公式コンテンツの一覧（鍵ごとに新しい版から）"
  task list: :environment do
    packages = ContentPackage.ordered.to_a
    if packages.empty?
      puts "まだ1つもありません"
      next
    end

    puts format("%-22s %5s %-9s %-10s %s", "鍵", "版", "種別", "扱い", "名前")
    packages.each do |p|
      c = p.summary_counts
      puts format("%-22s %5d %-9s %-10s %s  （カード#{c[:items]} 箱#{c[:boxes]} キャンバス#{c[:views]}）",
                  p.key, p.version, p.kind, p.status, p.name)
    end
  end

  desc "中身を確かめる（KEY=、VERSION= 省略で最新の公開版）"
  task show: :environment do
    package = find_package!
    c = package.summary_counts

    puts "#{package.name}（#{package.key} v#{package.version} / #{package.kind} / #{package.status}）"
    puts package.summary if package.summary.present?
    puts "カード #{c[:items]} / 箱 #{c[:boxes]} / キャンバス #{c[:views]} / タグ #{c[:tags]}"
    puts
    Array(package.payload["boxes"]).each do |box|
      puts "  箱: #{box['name']}（#{Array(box['entries']).size}枚）"
    end
    Array(package.payload["views"]).each do |view|
      puts "  キャンバス: #{view['name']}（#{Array(view['placements']).size}枚 / 線 #{Array(view['edges']).size}）"
    end
    puts
    Array(package.payload["items"]).each { |i| puts "    - #{i['title']}" }
  end

  desc "原本を選んで、新しい版として公開する"
  task publish: :environment do
    key = env!("KEY")
    kind = env!("KIND")
    name = env!("NAME")
    boxes = Box.where(id: ids("BOXES")).to_a
    views = View.where(id: ids("VIEWS")).to_a

    if boxes.empty? && views.empty?
      abort "BOXES か VIEWS のどちらかは要ります（例: BOXES=<uuid>,<uuid>）"
    end

    owners = (boxes + views).map(&:user_id).uniq
    abort "原本が複数の利用者にまたがっています" if owners.size > 1

    result = ContentPackages::Publisher.call(
      key: key, kind: kind, name: name, boxes: boxes, views: views,
      summary: ENV["SUMMARY"].presence, cover_image_key: ENV["COVER"].presence
    )
    c = result.counts
    puts "公開しました: #{result.package.key} v#{result.package.version}"
    puts "  カード #{c[:items]} / 箱 #{c[:boxes]} / キャンバス #{c[:views]} / タグ #{c[:tags]}"
  rescue ContentPackages::Payload::Error => e
    abort "公開できませんでした: #{e.message}"
  end

  # 確かめるための入口。**配る本番の口ではない。**
  #
  # 同じカードを2枚にしない仕組み（`owned:`）は、由来を記録している側が使う。
  # ここはまだそれを持たないので、2回走らせるとカードは2倍になる。
  # 驚かないよう、走らせるたびに言う
  desc "誰かの宮殿へ入れて確かめる（KEY=、EMAIL=）"
  task install: :environment do
    package = find_package!
    user = User.find_by(email: env!("EMAIL")) or abort "その利用者が見つかりません"

    result = package.install!(user: user)
    puts "入れました: #{user.email} へ #{package.key} v#{package.version}"
    puts "  作った #{result.created_items.size} 枚 / 使い回した #{result.reused_items.size} 枚"
    puts "  箱 #{result.boxes.size} / キャンバス #{result.views.size}"
    puts "  ※ 確認用の入口です。重ねて走らせるとカードも重なります"
    puts "     （2枚にしない仕組みは、受け取りの履歴と一緒に入ります）"
  rescue ContentPackages::Payload::Error => e
    abort "入れられませんでした: #{e.message}"
  end

  def env!(name)
    ENV[name].presence or abort "#{name}= を指定してください"
  end

  def ids(name)
    ENV[name].to_s.split(",").map(&:strip).reject(&:blank?)
  end

  def find_package!
    key = env!("KEY")
    if ENV["VERSION"].present?
      ContentPackage.find_by(key: key, version: ENV["VERSION"].to_i) or abort "その版がありません"
    else
      ContentPackage.latest_published(key) or abort "公開されている版がありません: #{key}"
    end
  end
end
