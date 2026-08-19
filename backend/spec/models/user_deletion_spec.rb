# frozen_string_literal: true

require "rails_helper"

# 退会できること。
#
# **実績を1つでも持っていると、退会が 500 で落ちていた。**
# `user_reward_grants` に外部キーが張ってあるのに、消す指定が無かった。
# ほとんどの利用者は何かしら受け取っているので、実質「誰も退会できない」状態だった。
#
# 同じ形の抜けが他に7つあったので、まとめて塞いだ。
# ここでは**users を指す外部キーを全部数え上げて**、
# 消す指定が漏れていないことを見張る（表が増えても気づける）。
RSpec.describe "退会" do
  let(:user) { create(:user, :confirmed) }

  describe "消せること" do
    it "実績を持っていても消せる" do
      reward = RewardDefinition.registry.first
      Achievements::Granter.grant(user: user, reward: reward, source: "manual", notify: false)
      expect(user.user_rewards.count).to eq(1)

      expect { user.destroy! }.to change(User, :count).by(-1)
    end

    it "カード・箱・キャンバスごと消える" do
      item_type = create(:item_type)
      user.items.create!(title: "ためし", item_type: item_type, generation_status: "completed")
      user.boxes.create!(name: "箱")
      user.views.create!(name: "板", view_type: "freeboard")

      user.destroy!

      expect(Item.where(user_id: user.id)).to be_empty
      expect(Box.where(user_id: user.id)).to be_empty
      expect(View.where(user_id: user.id)).to be_empty
    end

    it "公式コンテンツを受け取っていても消せる" do
      installation = ContentInstallation.create!(
        user: user, package_key: "starter_it", package_version: 1,
        source: "delphi", installed_at: Time.current
      )

      expect { user.destroy! }.to change(User, :count).by(-1)
      expect(ContentInstallation.find_by(id: installation.id)).to be_nil
    end
  end

  # 記録として要るものは、持ち主だけ外して残す。
  # **誰がやったかは消えるが、何が起きたかは残る**
  describe "残るもの" do
    it "運営の記録は残る（誰がやったかだけ消える）" do
      admin = create(:user, :confirmed, role: "admin")
      AdminAuditLog.record!(actor: admin, action: "test.action")
      log = AdminAuditLog.where(actor_id: admin.id).first

      admin.destroy!

      expect(log.reload.actor_id).to be_nil
      expect(log.action).to eq("test.action")
    end

    it "原価の記録は残る（過去の集計が変わらないように）" do
      usage = AiUsage.create!(user: user, kind: "meaning", model: "test",
                              prompt_tokens: 10, completion_tokens: 10, cost_points: 1,
                              created_at: Time.current)

      user.destroy!

      expect(usage.reload.user_id).to be_nil
    end
  end

  # 表が増えたときに気づけるようにする。
  # **外部キーを張ったのに消す指定を忘れると、その日から退会が落ちる**
  describe "抜けの見張り" do
    it "users を指す外部キーは、すべて後片付けが指定されている" do
      connection = ActiveRecord::Base.connection
      referencing = connection.tables.select do |table|
        connection.foreign_keys(table).any? { |fk| fk.to_table == "users" }
      end - [ "users" ]

      covered = User.reflect_on_all_associations
                    .select { |a| %i[has_many has_one].include?(a.macro) && a.options[:dependent] }
                    .filter_map { |a| a.klass.table_name rescue nil }
                    .uniq

      expect(referencing - covered).to be_empty,
                                       "後片付けの指定が無い表: #{(referencing - covered).join(', ')}"
    end
  end
end
