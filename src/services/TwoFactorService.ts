import { User } from '@prisma/client';

import { prisma } from 'src/db';
import { decryptSecret, hashRecoveryCode, verifyTotp } from 'src/utils/totp';

/**
 * Verify a user's second factor using either a TOTP code or a single-use
 * recovery code. Accepted TOTP steps are persisted to block replay, and
 * recovery codes are marked used atomically.
 */
export const verifySecondFactor = async (
    user: Pick<User, 'id' | 'twoFactorSecret' | 'twoFactorLastStep'>,
    input: { otp?: string; recoveryCode?: string },
): Promise<boolean> => {
    if (input.otp && user.twoFactorSecret) {
        const step = verifyTotp(decryptSecret(user.twoFactorSecret), String(input.otp), user.twoFactorLastStep);
        if (step === null) return false;

        // Conditional update guards against concurrent replay of the same code
        const { count } = await prisma.user.updateMany({
            where: {
                id: user.id,
                OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }],
            },
            data: { twoFactorLastStep: step },
        });

        return count === 1;
    }

    if (input.recoveryCode) {
        const { count } = await prisma.twoFactorRecoveryCode.updateMany({
            where: { userId: user.id, codeHash: hashRecoveryCode(String(input.recoveryCode)), usedAt: null },
            data: { usedAt: new Date() },
        });

        return count === 1;
    }

    return false;
};
