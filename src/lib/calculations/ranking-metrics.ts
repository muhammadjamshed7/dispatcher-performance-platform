export type RankingMetrics = {
  rank: number;
  score: number;
};

export function calculateRankingMetrics(): RankingMetrics {
  return {
    rank: 0,
    score: 0,
  };
}
