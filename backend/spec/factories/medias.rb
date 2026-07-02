FactoryBot.define do
  factory :media do
    item
    media_type { "image" }
    position { 0 }

    trait :with_file do
      after(:build) do |media|
        media.file.attach(
          io: StringIO.new("fake image payload"),
          filename: "#{SecureRandom.uuid}.png",
          content_type: "image/png"
        )
      end
    end

    # 事前生成済みサムネ（本番の OptimizeImageService 相当）も添付する
    trait :with_thumb do
      with_file

      after(:build) do |media|
        media.thumb.attach(
          io: StringIO.new("fake thumb payload"),
          filename: "#{SecureRandom.uuid}.webp",
          content_type: "image/webp"
        )
      end
    end
  end
end
