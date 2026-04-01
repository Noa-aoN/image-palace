class NormalizePromptService
  def self.call(text)
    text.to_s.unicode_normalize(:nfkc).downcase.strip.gsub(/\s+/, " ")
  end
end
