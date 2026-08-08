# frozen_string_literal: true

module Views
  # 承認されたカードを作って、このキャンバスに載せる。
  #
  # 作成そのものは Items::CreateService に任せる。クレジットの確認・モデレーション・
  # 画像生成の起動が全てそこに集約されているので、ここで別経路を作らない
  # （別経路を作ると、片方だけ制限が抜ける形になる）。
  #
  # 途中で残高が尽きたら、そこで止めて作れたぶんだけ返す。全部巻き戻すと
  # 「1枚も作れないのにクレジットだけ減った」ように見える事故が起きやすい。
  class CardCreationService
    def self.call(view:, titles:)
      new(view:, titles:).call
    end

    def initialize(view:, titles:)
      @view = view
      @user = view.user
      @titles = titles
    end

    def call
      created = []

      @titles.each do |title|
        item = Items::CreateService.call(user: @user, params: { title: title }).item
        attach!(item)
        created << item
      rescue Items::CreateService::InsufficientCredits
        # 残高が尽きた。作れたぶんは残す（呼び出し側が枚数を返す）
        break
      rescue Items::CreateService::ContentBlocked => e
        Rails.logger.info "[CardCreationService] blocked title=#{title} #{e.message}"
        next
      end

      created
    end

    private

    def attach!(item)
      @view.view_items.create!(
        item: item,
        position: next_position,
        x: 0,
        y: 0
      )
    end

    def next_position
      (@view.view_items.maximum(:position) || 0) + 1
    end
  end
end
