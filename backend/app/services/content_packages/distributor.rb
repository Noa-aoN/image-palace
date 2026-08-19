# frozen_string_literal: true

module ContentPackages
  # 公式コンテンツを、その人へ配る。
  #
  #   ContentPackages::Distributor.call(user: user, key: "starter_it", source: "delphi")
  #
  # **デモも、デルフォイの「受け取る」も、登録直後の持ち帰りも、
  # 将来のミッション報酬・引き換えコード・購入も、すべてここを通る。**
  # 入口が違うだけで、やることは同じにしておく。
  #
  # ## 守ること
  #
  #   1. 同じ箱を2回持たない        … 一意索引で（連打・二重送信でも必ず片方が落ちる）
  #   2. 無料で取れるのは決めた数だけ … 行を掴んで数える
  #   3. 同じカードを2枚にしない      … 既に持っている公式のカードを使い回す
  #   4. 誰が何を受け取ったか残す     … 受け取りと、生まれた実体の両方
  class Distributor
    class Error < StandardError; end
    # もう持っている
    class AlreadyInstalled < Error; end
    # 無料の枠を使い切っている
    class FreeLimitReached < Error; end
    # 配れる荷物が無い
    class NotDistributable < Error; end

    Result = Struct.new(:installation, :package, :imported, keyword_init: true) do
      def created_count = imported.created_items.size
      def reused_count  = imported.reused_items.size
    end

    def self.call(...)
      new(...).call
    end

    def initialize(user:, key: nil, package: nil, source: "starter_free")
      @user = user
      @key = key
      @package = package
      @source = source.to_s
    end

    def call
      package = resolve_package!

      # **利用者の行を掴んでから数える。**
      # 2つの受け取りが同時に来ても、無料の枠を2回すり抜けられないようにする
      @user.with_lock do
        ensure_not_installed!(package)
        ensure_free_limit!

        installation = ContentInstallation.create!(
          user: @user, package_key: package.key, package_version: package.version,
          source: @source, installed_at: Time.current
        )

        imported = package.install!(user: @user, owned: ContentInstallation.owned_items_for(@user))
        record_entries!(installation, imported)

        Result.new(installation: installation, package: package, imported: imported)
      end
    rescue ActiveRecord::RecordNotUnique
      # 索引が落とした＝同時に2回来た。**あとから来た側だけが断られる**
      raise AlreadyInstalled, "この公式コンテンツは、すでに受け取っています"
    end

    private

    def resolve_package!
      package = @package || ContentPackage.latest_published(@key)
      raise NotDistributable, "配れる公式コンテンツが見つかりません" if package.nil?
      raise NotDistributable, "この公式コンテンツはいま配っていません" unless package.published?

      package
    end

    def ensure_not_installed!(package)
      return unless ContentInstallation.exists?(user_id: @user.id, package_key: package.key)

      raise AlreadyInstalled, "この公式コンテンツは、すでに受け取っています"
    end

    def ensure_free_limit!
      return unless ContentInstallation::FREE_SOURCES.include?(@source)
      return unless ContentInstallation.free_used?(@user)

      raise FreeLimitReached, "無料で受け取れるのは#{ContentInstallation::FREE_LIMIT}つまでです"
    end

    # 生まれた実体の由来を残す。
    #
    # **使い回したカードにも1本生やす。** 「この荷物もあのカードを使っている」
    # ことが分かるようにするため（1枚のカードに複数の受け取りがぶら下がる）
    def record_entries!(installation, imported)
      rows = []

      imported.items_by_local_key.each do |local_key, item|
        rows << {
          content_installation_id: installation.id,
          record_type: "Item", record_id: item.id,
          package_local_key: local_key,
          origin_key: imported.origin_keys[local_key]
        }
      end
      # 箱とキャンバスには荷物の中の鍵も目印も無いが、**列は揃えて渡す**
      # （まとめて入れるとき、鍵の違う行が混ざると受け付けてもらえない）
      (imported.boxes + imported.views).each do |record|
        rows << {
          content_installation_id: installation.id,
          record_type: record.class.name, record_id: record.id,
          package_local_key: nil, origin_key: nil
        }
      end

      now = Time.current
      ContentInstallationEntry.insert_all!(rows.map { |r| r.merge(created_at: now, updated_at: now) })
    end
  end
end
