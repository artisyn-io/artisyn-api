import { prisma } from "src/db";

/**
 * PrivacyGuard — enforces flag-based privacy controls at runtime.
 *
 * Each guard returns a structured result rather than throwing, so callers
 * can decide the appropriate HTTP response (403, 404, silent discard, etc.).
 *
 * Flags covered
 * ─────────────
 * • searchEngineIndexing  — controls X-Robots-Tag header on public profile responses
 * • allowDirectMessages   — gate on any endpoint that sends a message to a user
 * • allowProfileComments  — gate on any endpoint that posts a comment on a user's profile
 */
export class PrivacyGuard {
  /**
   * Returns the value to set on the X-Robots-Tag response header for a
   * user's public-facing profile page.
   *
   * When searchEngineIndexing is false the profile must carry
   * `X-Robots-Tag: noindex, nofollow` so search engines do not crawl it.
   */
  static async getRobotsDirective(userId: string): Promise<string> {
    const settings = await prisma.privacySettings.findFirst({
      where: { userId },
      select: { searchEngineIndexing: true },
    });

    if (settings === null || settings.searchEngineIndexing) {
      return "index, follow";
    }
    return "noindex, nofollow";
  }

  /**
   * Returns whether `senderId` is permitted to send a direct message to
   * `targetUserId`.
   *
   * Enforcement rules
   *   1. Users can always message themselves (edge-case / admin tools).
   *   2. If the target has no PrivacySettings row, messages are allowed (safe default).
   *   3. Otherwise, the flag value is authoritative.
   */
  static async canSendDirectMessage(
    senderId: string,
    targetUserId: string,
  ): Promise<PrivacyCheckResult> {
    if (senderId === targetUserId) {
      return { allowed: true };
    }

    const settings = await prisma.privacySettings.findFirst({
      where: { userId: targetUserId },
      select: { allowDirectMessages: true },
    });

    if (settings === null || settings.allowDirectMessages) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "This user does not accept direct messages.",
    };
  }

  /**
   * Returns whether `commenterId` is permitted to post a comment on
   * `targetUserId`'s profile.
   *
   * Same default-allow logic as canSendDirectMessage.
   */
  static async canPostProfileComment(
    commenterId: string,
    targetUserId: string,
  ): Promise<PrivacyCheckResult> {
    if (commenterId === targetUserId) {
      return { allowed: true };
    }

    const settings = await prisma.privacySettings.findFirst({
      where: { userId: targetUserId },
      select: { allowProfileComments: true },
    });

    if (settings === null || settings.allowProfileComments) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "This user has disabled profile comments.",
    };
  }
}

export interface PrivacyCheckResult {
  allowed: boolean;
  /** Human-readable reason returned to the caller when allowed === false */
  reason?: string;
}
