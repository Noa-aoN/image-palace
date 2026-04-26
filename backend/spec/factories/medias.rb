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
  end
end
