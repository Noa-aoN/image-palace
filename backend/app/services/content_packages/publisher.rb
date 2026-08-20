# frozen_string_literal: true

module ContentPackages
  # 原本を選んで、新しい版として公開する。
  #
  #   ContentPackages::Publisher.call(
  #     key: "starter_it", kind: "starter", name: "ITのことば",
  #     boxes: [box], views: [view], actor: current_user
  #   )
  #
  # **rake も、いずれ作る工房室の「公開する」も、ここを呼ぶ。**
  # 押す場所が違うだけで、やることは同じにしておく。
  #
  # 書き出し（Exporter）が欠けを見つけたら、そこで止まる。
  # 半端なものを公開して、配ってから気づくことにならないようにするため。
  #
  # ## 誰が出したかを残す
  #
  # 原本を持つ口座は1つだが、**それを触る人はいずれ増える**。
  # そのとき「この版を出したのは誰か」が分からないと、
  # 中身の食い違いを追えない。運営の記録（`AdminAuditLog`）にそのまま残す
  # （あちらはメールも一緒に持つので、退会したあとも誰だったか分かる）。
  class Publisher
    Result = Struct.new(:package, :counts, keyword_init: true)

    def self.call(...)
      new(...).call
    end

    # @param actor [User, nil] 実際に押した人。原本の持ち主とは限らない
    def initialize(key:, kind:, name:, boxes: [], views: [], summary: nil, cover_image_key: nil,
                   actor: nil)
      @key = key
      @kind = kind
      @name = name
      @boxes = Array(boxes)
      @views = Array(views)
      @summary = summary
      @cover_image_key = cover_image_key
      @actor = actor
    end

    def call
      payload = Exporter.call(boxes: @boxes, views: @views)

      package = ContentPackage.publish!(
        key: @key, kind: @kind, name: @name, payload: payload,
        summary: @summary, cover_image_key: @cover_image_key
      )
      record_audit!(package)

      Result.new(package: package, counts: package.summary_counts)
    end

    private

    # 記録に失敗しても公開そのものは止めない（`AdminAuditLog.record!` がそう作られている）
    def record_audit!(package)
      AdminAuditLog.record!(
        actor: @actor,
        action: "content_package.publish",
        target: package,
        details: {
          "key" => package.key, "version" => package.version, "kind" => package.kind,
          "owner_id" => (@boxes + @views).first&.user_id,
          "counts" => package.summary_counts
        }
      )
    end
  end
end
