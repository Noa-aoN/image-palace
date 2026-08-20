# frozen_string_literal: true

module Studio
  # 公式コンテンツの下見。**出す前に、受け取った人と同じ画面で見る。**
  #
  #   Studio::Preview.start!(user: me, package: package)
  #   Studio::Preview.current(me)
  #   Studio::Preview.discard!(me)
  #
  # ## 受け取りとは分ける
  #
  # 自分の口座に入れて見るので、形は受け取りと同じになる。
  # だが**中身は同じでも、数えるものが違う**。
  #
  #   ・配った数に入れない（`ContentInstallation.real` から外れる）
  #   ・無料枠を使わない（`FREE_SOURCES` に入っていない）
  #   ・寿命がある（放っておいても消える）
  #   ・何度でもやり直せる（前のを片付けてから入れ直す）
  #
  # ## いつも1つだけ
  #
  # 2つ並ぶと、どちらを見ているのか分からなくなる。
  # DB の索引でも1人1つに決めてある（`index_content_installations_single_preview`）。
  class Preview
    # 放っておいても消える。**片付け忘れた下見が宮殿に残り続けない**ように
    LIFETIME = 24.hours

    SOURCE = ContentInstallation::PREVIEW_SOURCE

    class << self
      # いま見ている下見。寿命が切れていたら無いものとして返す
      def current(user)
        row = ContentInstallation.find_by(user_id: user.id, source: SOURCE)
        return nil if row.nil?
        return nil if expired?(row)

        row
      end

      def expired?(installation)
        installation.installed_at <= Time.current - LIFETIME
      end

      def expires_at(installation)
        installation.installed_at + LIFETIME
      end

      # 下見を始める。**前のは必ず片付けてから入れる。**
      #
      # 何度でも押せるようにするため。押すたびに宮殿が散らかると、
      # どれが本物か分からなくなる
      def start!(user:, package:)
        discard!(user)

        imported = ContentPackages::Importer.call(user: user, payload: package.payload)
        installation = ContentInstallation.create!(
          user: user, package_key: package.key, package_version: package.version,
          source: SOURCE, installed_at: Time.current
        )
        record_entries!(installation, imported)

        [ installation, imported ]
      end

      # 下見を片付ける。**カードごと消す**（残すと本物と混ざる）。
      #
      # 1枚ずつ落とすのは、途中で1枚こけても残りを片付けたいため。
      # 消せなかったものがあっても受け取りの行は消す（次の下見を始められるように）
      def discard!(user)
        ContentInstallation.where(user_id: user.id, source: SOURCE).find_each do |installation|
          destroy_records!(installation)
          installation.destroy!
        end
      end

      # 寿命の切れた下見を片付ける。**1時間おきに呼ばれる**
      def sweep!(now: Time.current)
        stale = ContentInstallation.where(source: SOURCE).where(installed_at: ..(now - LIFETIME))
        count = 0

        stale.find_each do |installation|
          destroy_records!(installation)
          installation.destroy!
          count += 1
        end

        count
      end

      # 下見で入れた箱とキャンバス。**開く先を示すため**
      def entry_points(installation)
        records = installation.entries.where(record_type: %w[Box View]).includes(:record)

        {
          box_id: records.find { |e| e.record_type == "Box" }&.record_id,
          view_id: records.find { |e| e.record_type == "View" }&.record_id
        }
      end

      private

      def destroy_records!(installation)
        installation.entries.each do |entry|
          entry.record&.destroy
        rescue StandardError => e
          Rails.logger.warn "[Studio::Preview] 下見の片付けに失敗: #{e.class}: #{e.message}"
        end
      end

      def record_entries!(installation, imported)
        now = Time.current
        rows = imported.items_by_local_key.map do |local_key, item|
          { content_installation_id: installation.id, record_type: "Item", record_id: item.id,
            package_local_key: local_key, origin_key: imported.origin_keys[local_key] }
        end
        (imported.boxes + imported.views).each do |record|
          rows << { content_installation_id: installation.id, record_type: record.class.name,
                    record_id: record.id, package_local_key: nil, origin_key: nil }
        end

        ContentInstallationEntry.insert_all!(rows.map { |r| r.merge(created_at: now, updated_at: now) })
      end
    end
  end
end
