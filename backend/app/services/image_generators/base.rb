module ImageGenerators
  class Base
    # サブクラスで実装必須
    # @param prompt [String] 画像生成に使うプロンプト
    # @return [Hash] { image_data: String(binary), content_type: String, metadata: Hash }
    def generate(prompt:)
      raise NotImplementedError, "#{self.class}#generate を実装してください"
    end
  end
end
