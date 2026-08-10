import { apiClient } from './client'

/**
 * 作りかけの機能をどこまで見せるか。
 *
 * hidden      … 入口ごと出さない
 * development … 「開発中」と出すが触れない
 * prototype   … 触れる。ただし粗さを了解してもらうため印を付ける
 * released    … 普通の機能。印は付けない
 */
export type FeatureStage = 'hidden' | 'development' | 'prototype' | 'released'

export type FeatureStages = Record<string, FeatureStage>

export interface FeatureStagesResponse {
  features: FeatureStages
  /** パス → キー。いま開いている場所から段階を引くのに使う */
  paths: Record<string, string>
}

export async function getFeatureStages(): Promise<FeatureStagesResponse> {
  const res = await apiClient.get<FeatureStagesResponse>('/api/v1/features')
  return res.data
}
