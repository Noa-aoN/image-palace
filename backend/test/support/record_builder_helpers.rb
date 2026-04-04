module RecordBuilderHelpers
  require "stringio"

  def create_confirmed_user(email: "test-#{SecureRandom.hex(4)}@example.com")
    User.create!(
      email: email,
      password: "password123",
      password_confirmation: "password123",
      provider: "email",
      uid: email,
      confirmed_at: Time.current
    )
  end

  def default_item_type
    ItemType.find_or_create_by!(name: "term") do |item_type|
      item_type.label = "用語"
    end
  end

  def create_shared_media_for(prompt:, user:, metadata: {})
    shared_media = SharedMedia.create!(
      normalized_prompt: NormalizePromptService.call(prompt),
      user: user,
      metadata: metadata
    )
    shared_media.file.attach(
      io: StringIO.new("fake image payload"),
      filename: "#{SecureRandom.uuid}.png",
      content_type: "image/png"
    )
    shared_media
  end
end
