/**
 * Health score calculation for the Customer Intelligence Dashboard.
 * Combines payment, engagement, contract, and support signals into a
 * single weighted health score (Payment 40%, Engagement 30%, Contract 20%, Support 10%).
 */

export interface PaymentHistory {
  daysSinceLastPayment: number;
  averagePaymentDelay: number;
  overdueAmount: number;
}

export interface EngagementMetrics {
  loginFrequency: number;
  featureUsageCount: number;
  supportTickets: number;
}

export interface ContractInfo {
  daysUntilRenewal: number;
  contractValue: number;
  recentUpgrades: number;
}

export interface SupportData {
  averageResolutionTime: number;
  satisfactionScore: number;
  escalationCount: number;
}

export interface HealthScoreInput {
  payment: PaymentHistory;
  engagement: EngagementMetrics;
  contract: ContractInfo;
  support: SupportData;
}

export type RiskLevel = 'healthy' | 'warning' | 'critical';

export interface HealthFactorScore {
  score: number;
  weight: number;
}

export interface HealthScoreBreakdown {
  payment: HealthFactorScore;
  engagement: HealthFactorScore;
  contract: HealthFactorScore;
  support: HealthFactorScore;
}

export interface HealthScoreResult {
  overallScore: number;
  riskLevel: RiskLevel;
  breakdown: HealthScoreBreakdown;
}

const FACTOR_WEIGHTS = {
  payment: 0.4,
  engagement: 0.3,
  contract: 0.2,
  support: 0.1,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function scorePayment(payment: PaymentHistory): number {
  const latenessPenalty = Math.max(0, payment.daysSinceLastPayment - 30);
  const delayPenalty = payment.averagePaymentDelay * 2;
  const overduePenalty = payment.overdueAmount / 100;
  return clamp(100 - latenessPenalty - delayPenalty - overduePenalty);
}

function scoreEngagement(engagement: EngagementMetrics): number {
  const loginScore = clamp((engagement.loginFrequency / 7) * 100);
  const featureScore = clamp((engagement.featureUsageCount / 30) * 100);
  const ticketPenalty = clamp(engagement.supportTickets * 5);
  return clamp(loginScore * 0.4 + featureScore * 0.4 + (100 - ticketPenalty) * 0.2);
}

function scoreContract(contract: ContractInfo): number {
  const renewalScore =
    contract.daysUntilRenewal < 0
      ? 20
      : clamp(100 - Math.max(0, 30 - contract.daysUntilRenewal) * 1.5);
  const upgradeBonus = clamp(contract.recentUpgrades * 10, 0, 30);
  const valueScore = clamp((contract.contractValue / 1000) * 100);
  return clamp(renewalScore * 0.7 + valueScore * 0.1 + upgradeBonus);
}

function scoreSupport(support: SupportData): number {
  const resolutionScore = clamp(100 - support.averageResolutionTime * 2);
  const satisfactionScore = clamp(support.satisfactionScore);
  const escalationPenalty = support.escalationCount * 5;
  return clamp(satisfactionScore * 0.6 + resolutionScore * 0.4 - escalationPenalty);
}

function classifyRisk(overallScore: number): RiskLevel {
  if (overallScore <= 30) return 'critical';
  if (overallScore <= 70) return 'warning';
  return 'healthy';
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  if (!input || !input.payment || !input.engagement || !input.contract || !input.support) {
    throw new Error('Incomplete health score input data');
  }

  const paymentScore = scorePayment(input.payment);
  const engagementScore = scoreEngagement(input.engagement);
  const contractScore = scoreContract(input.contract);
  const supportScore = scoreSupport(input.support);

  const overallScore = Math.round(
    paymentScore * FACTOR_WEIGHTS.payment +
      engagementScore * FACTOR_WEIGHTS.engagement +
      contractScore * FACTOR_WEIGHTS.contract +
      supportScore * FACTOR_WEIGHTS.support
  );

  return {
    overallScore: clamp(overallScore),
    riskLevel: classifyRisk(overallScore),
    breakdown: {
      payment: { score: Math.round(paymentScore), weight: FACTOR_WEIGHTS.payment },
      engagement: { score: Math.round(engagementScore), weight: FACTOR_WEIGHTS.engagement },
      contract: { score: Math.round(contractScore), weight: FACTOR_WEIGHTS.contract },
      support: { score: Math.round(supportScore), weight: FACTOR_WEIGHTS.support },
    },
  };
}
