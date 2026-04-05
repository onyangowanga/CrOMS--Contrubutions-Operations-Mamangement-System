interface ContributorCandidate {
  id: string;
  formal_name: string;
  display_name: string;
  alternate_senders: string[] | null;
}

export interface MatchResult {
  exact: boolean;
  score: number;
  contributor: ContributorCandidate | null;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function similarity(left: string, right: string): number {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return 0.9;
  }

  return jaccard(tokenSet(normalizedLeft), tokenSet(normalizedRight));
}

export function findBestContributorMatch(
  senderName: string,
  contributors: ContributorCandidate[]
): MatchResult {
  let bestContributor: ContributorCandidate | null = null;
  let bestScore = 0;

  for (const contributor of contributors) {
    const names = [
      contributor.formal_name,
      contributor.display_name,
      ...(Array.isArray(contributor.alternate_senders) ? contributor.alternate_senders : []),
    ];

    for (const name of names) {
      const score = similarity(senderName, name);
      if (score > bestScore) {
        bestScore = score;
        bestContributor = contributor;
      }
      if (score === 1) {
        return { exact: true, score, contributor };
      }
    }
  }

  return {
    exact: false,
    score: bestScore,
    contributor: bestContributor,
  };
}
