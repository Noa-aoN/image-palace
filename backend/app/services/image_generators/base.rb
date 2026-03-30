module ImageGenerators
  class Base
    # サブクラスで実装必須
    # @param prompt [String] 画像生成に使うプロンプト
    # @return [Hash] { url: String, metadata: Hash }
    def generate(prompt:)
      raise NotImplementedError, "#{self.class}#generate を実装してください"
    end
  end
end
