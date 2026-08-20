# frozen_string_literal: true

# **下見は受け取りではない。** 数え方も、重なり方も分ける。
#
# これまでは (user_id, package_key) に一意索引が張ってあり、
# 「同じ箱を2回持たない」を守っていた。だが下見もこの索引に入るので、
# **すでに受け取っている荷物を下見しようとすると落ちる**。
#
# 工房に入れるのは運営でもあるので、その口座がデルフォイで
# Starter を受け取っていることは普通にある。v1 を持ったまま v3 を下見したい、
# はまさにやりたいことで、そこで落ちるのはおかしい。
#
# 索引を2つに割る。
#
#   1. 受け取り  … (user_id, package_key) は1つまで（下見は除く）
#   2. 下見      … 1人につき1つまで（荷物を問わず）
#
# 2 があるので「下見は常に1つ」がDBで決まる。
# 別の荷物を下見したら前のは片付く、を取りこぼしても二重にはならない。
class AllowPreviewAlongsideRealInstallation < ActiveRecord::Migration[8.1]
  def up
    remove_index :content_installations, column: [ :user_id, :package_key ]

    add_index :content_installations, [ :user_id, :package_key ],
              unique: true, where: "source <> 'preview'",
              name: "index_content_installations_unique_receipt"

    add_index :content_installations, :user_id,
              unique: true, where: "source = 'preview'",
              name: "index_content_installations_single_preview"
  end

  def down
    remove_index :content_installations, name: "index_content_installations_single_preview"
    remove_index :content_installations, name: "index_content_installations_unique_receipt"

    # 戻すときは、下見を先に片付けないと索引が張れない
    execute "DELETE FROM content_installations WHERE source = 'preview'"
    add_index :content_installations, [ :user_id, :package_key ], unique: true
  end
end
