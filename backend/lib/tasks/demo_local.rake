# frozen_string_literal: true

# 手元で体験用の宮殿を試せるようにする。
#
#   bin/rails demo:setup_local
#
# **本番では走らない。** 口座や見本を勝手に作るので、
# 開発環境でだけ動くようにしてある。
#
# やること
#   1. 公式コンテンツの口座を用意する（無ければ作る）
#   2. 見本のカードを少しだけ作る（絵は小さな PNG）
#   3. 箱とキャンバスに入れる
#   4. demo_showcase として公開する
#   5. 入口を開ける
namespace :demo do
  # 小さな PNG。**中身は問わない**（絵が付いていることだけ確かめられればよい）
  TINY_PNG = [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
               "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
               "0000000049454e44ae426082" ].pack("H*").freeze

  SAMPLE_BOX = "ネットワークの通り道"

  SAMPLE_ITEMS = [
    [ "クライアント", "通信を始める側。手元の機械" ],
    [ "DNS", "名前を住所に直す仕組み" ],
    [ "ルーター", "どの道を通すかを選ぶ機械" ],
    [ "サーバー", "通信を受け取って返す側" ]
  ].freeze

  SAMPLE_EDGES = [
    [ "クライアント", "DNS", "名前を引く" ],
    [ "DNS", "ルーター", nil ],
    [ "ルーター", "サーバー", "届く" ]
  ].freeze

  desc "手元で工房室と体験用の宮殿を試せるようにする（開発環境のみ）"
  task setup_local: :environment do
    abort "本番では走らせません" if Rails.env.production?

    official, secret = find_or_create_official!
    box, view = build_sample!(official)

    result = ContentPackages::Publisher.call(
      key: "demo_showcase", kind: "demo", name: "はじまりの宮殿",
      summary: "ImagePalace でできることを、ひととおり",
      boxes: [ box ], views: [ view ], actor: official
    )
    package = result.package

    # 届け先に「体験の宮殿に置く」を入れる。**入れないと宮殿が組めない**
    ContentDelivery.set!(package_key: package.key, channel: "demo", enabled: true)
    FeatureFlag.find_or_initialize_by(key: "demo_entry").update!(stage: "released")

    puts
    puts "用意できました。"
    puts "  公式の口座 : #{official.email}"
    puts "  荷物       : #{package.key} v#{package.version}（カード #{package.summary_counts[:items]}）"
    puts "  届け先     : 体験の宮殿に置く"
    puts "  入口       : 開いています"
    puts
    puts "  工房室へは、この口座で入ります:"
    puts "    #{official.email}"
    if secret
      puts "    #{secret}   ← いま作りました"
      puts "    #{sign_in_check(official.email, secret)}"
    else
      puts "    合言葉は**変えていません**（走らせるたびに作り直すと、控えたものが使えなくなるため）"
      puts "    忘れたときは: bin/rails demo:studio_password"
    end
    puts
    puts "  ふだんの口座（運営）とは分けてあります。執務室とはぶつかりません。"
    puts "  `.env` に id を書き写す必要はありません。"
  end

  # 公式コンテンツの口座を用意して、入り方ごと返す。
  #
  # **すでにある口座の合言葉は変えない。**
  #
  # 前は走らせるたびに作り直していた。見本を入れ直すだけのつもりで走らせると、
  # そのたびに前に控えた合言葉が使えなくなる。実際それで入れなくなった。
  #
  # 忘れたときは `bin/rails demo:studio_password` で入れ直す。
  #
  # ふだんの口座（運営）とは分けてある。役割は `user` のままでよく、
  # 工房室へは「公式の口座であること」で入れる
  def find_or_create_official!
    email = User::LOCAL_OFFICIAL_EMAIL
    user = User.official_content_account || User.find_by(email: email) || rename_old_local_official(email)

    return [ user, nil ] if user

    secret = SecureRandom.alphanumeric(20)
    [ User.create!(email: email, password: secret, password_confirmation: secret,
                   confirmed_at: Time.current, name: "公式"), secret ]
  end

  # 合言葉を入れ直して、**入れることを確かめてから**出す
  def reset_password!(user)
    secret = SecureRandom.alphanumeric(20)
    user.update!(password: secret, password_confirmation: secret)

    puts "  #{user.email}"
    puts "  #{secret}"
    puts "  #{sign_in_check(user.email, secret)}"
  end

  # **本当に入れるかを、その場で確かめる。**
  #
  # 「合言葉を入れ直した」と言うだけでは、入れなかったときに
  # どこが悪いのか分からない（uid のずれ・未確認・devise の設定）。
  # 実際にログインの口を叩いて、通ったことを見てから出す
  def sign_in_check(email, secret)
    session = ActionDispatch::Integration::Session.new(Rails.application)
    session.host = "localhost"
    session.post "/api/v1/auth/sign_in", params: { email: email, password: secret }, as: :json

    return "↑ この合言葉で入れることを確かめました" if session.response.status == 200

    body = session.response.body.to_s[0, 200]
    "↑ 入れませんでした（#{session.response.status}）。#{body}"
  end

  # 前のアドレス（手元だけで使っていたもの）で作ってあった口座を引き継ぐ。
  # 作り直すと、そこに作った宮殿の中身が置き去りになる
  def rename_old_local_official(email)
    old = User.find_by(email: "studio@local.invalid")
    return nil if old.nil?

    old.update!(email: email, uid: email)
    puts "  前の公式の口座を #{email} へ移しました（宮殿の中身はそのまま）"
    old
  end

  def build_sample!(official)
    item_type = ItemType.first || ItemType.create!(name: "word", label: "単語")
    box = official.boxes.find_by(name: SAMPLE_BOX) || official.boxes.create!(name: SAMPLE_BOX)

    items = SAMPLE_ITEMS.each_with_index.to_h do |(title, definition), index|
      item = official.items.find_by(title: title) ||
             official.items.create!(title: title, item_type: item_type, generation_status: "completed")

      if item.medias.empty?
        item.medias.create!(media_type: "image", position: 0)
            .file.attach(io: StringIO.new(TINY_PNG), filename: "#{index}.png", content_type: "image/png")
      end
      item.meanings.create!(definition: definition, language_code: "ja", position: 0) if item.meanings.empty?
      box.box_entries.create!(entry: item, position: index + 1) unless box.box_entries.exists?(entry: item)

      [ title, item ]
    end

    view = official.views.find_by(name: SAMPLE_BOX) ||
           official.views.create!(name: SAMPLE_BOX, view_type: "freeboard")

    items.values.each_with_index do |item, index|
      placement = view.view_items.find_or_initialize_by(item: item)
      placement.assign_attributes(x: index * 320, y: 0, width: 240, height: 300,
                                  z_index: index, position: index)
      placement.save!
    end

    view.view_edges.destroy_all
    SAMPLE_EDGES.each_with_index do |(from, to, label), index|
      view.view_edges.create!(source_node_id: items.fetch(from).id, target_node_id: items.fetch(to).id,
                              label: label, z_index: index)
    end

    [ box, view ]
  end
  desc "工房の口座の合言葉を入れ直す（開発環境のみ）"
  task studio_password: :environment do
    abort "本番では走らせません" if Rails.env.production?

    user = User.find_by(email: User::LOCAL_OFFICIAL_EMAIL)
    abort "口座がありません。先に bin/rails demo:setup_local を走らせてください" if user.nil?

    puts "工房室へは、この口座で入ります:"
    reset_password!(user)
  end
end
