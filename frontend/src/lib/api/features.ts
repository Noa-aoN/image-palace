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

export async function getFeatureStages(): Promise<FeatureStages> {
  const res = await apiClient.get<{ features: FeatureStages }>('/api/v1/features')
  return res.data.features
}
