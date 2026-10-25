import { BusinessCandidate } from '../services/businessMapService';

export interface QualityScoreResult {
  score: number;
  grade: 'ELITE' | 'HIGH' | 'GOOD' | 'FAIR';
  label: string;
  reasons: string[];
  penalties: string[];
}

/**
 * Calculates a transparent, deterministic Lead Quality score (0 - 100)
 * based strictly on factual attributes returned by the discovery provider and CRM state.
 * No mysterious AI scoring—every point is traceable.
 */
export function calculateLeadQualityScore(
  candidate: Partial<BusinessCandidate>,
  inCrm = false
): QualityScoreResult {
  let score = 20; // Base score for any verified registered commercial entity
  const reasons: string[] = ['+ Commercial business entity'];
  const penalties: string[] = [];

  // Phone availability (+25)
  if (candidate.phone && candidate.phone.trim().length >= 6) {
    score += 25;
    reasons.push('+ Direct phone number available');
  } else {
    penalties.push('- No direct phone listed');
  }

  // Website availability (+20)
  if (candidate.website && candidate.website.trim().length > 4) {
    score += 20;
    reasons.push('+ Website / digital presence verified');
  } else {
    penalties.push('- No website listed');
  }

  // Address and physical presence (+15)
  if (candidate.address && candidate.address.trim().length > 3) {
    score += 15;
    reasons.push('+ Physical address documented');
  } else if (candidate.area || candidate.city) {
    score += 8;
    reasons.push('+ Area / city location documented');
  }

  // Opening hours or active business status (+10)
  if (candidate.openingHours || candidate.businessStatus === 'OPERATIONAL') {
    score += 10;
    reasons.push('+ Active business hours / operational status');
  }

  // Social / rating presence (+10)
  if (candidate.rating && candidate.rating > 0) {
    score += 10;
    reasons.push(`+ Verified ratings (${candidate.rating.toFixed(1)}★, ${candidate.reviewCount || 0} reviews)`);
  }

  // CRM State modifier
  if (inCrm || candidate.inCrm) {
    score = Math.max(10, score - 30);
    penalties.push('- Already recorded in CRM');
  } else {
    reasons.push('+ Fresh candidate (Not yet in CRM)');
  }

  // Clamp 0 to 100
  score = Math.min(100, Math.max(5, score));

  let grade: 'ELITE' | 'HIGH' | 'GOOD' | 'FAIR' = 'GOOD';
  let label = 'GOOD CANDIDATE';

  if (score >= 85) {
    grade = 'ELITE';
    label = 'ELITE CANDIDATE';
  } else if (score >= 70) {
    grade = 'HIGH';
    label = 'HIGH POTENTIAL';
  } else if (score >= 45) {
    grade = 'GOOD';
    label = 'GOOD CANDIDATE';
  } else {
    grade = 'FAIR';
    label = 'NEEDS ENRICHMENT';
  }

  return {
    score,
    grade,
    label,
    reasons,
    penalties,
  };
}
