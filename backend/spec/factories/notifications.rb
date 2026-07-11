FactoryBot.define do
  factory :notification do
    user
    kind { "item_generation_completed" }
    sequence(:title) { |n| "「card-#{n}」の画像生成が完了しました" }
    url { "/items/#{SecureRandom.uuid}" }
    payload { { "count" => 1 } }

    trait :read do
      read_at { Time.current }
    end

    trait :failed_generation do
      kind { "item_generation_failed" }
      title { "「card」の画像生成に失敗しました" }
      body { "入力が曖昧なため画像を生成できませんでした。" }
    end

    trait :announcement do
      kind { "announcement" }
      title { "アップデートのお知らせ" }
      body { "スペース機能を追加しました。" }
      url { "/guide" }
      payload { {} }
    end
  end
end
