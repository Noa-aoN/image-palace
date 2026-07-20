require "rails_helper"

RSpec.describe ViewEdge, type: :model do
  let(:view) { create(:view, user: create(:user, :confirmed)) }

  it "有効なファクトリ" do
    expect(build(:view_edge, view: view)).to be_valid
  end

  it "source_node_id は必須" do
    expect(build(:view_edge, view: view, source_node_id: nil)).not_to be_valid
  end

  it "target_node_id は必須" do
    expect(build(:view_edge, view: view, target_node_id: nil)).not_to be_valid
  end
end
