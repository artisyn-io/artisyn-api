import LoginController from 'src/controllers/auth/LoginController';
import PasswordResetController from 'src/controllers/auth/PasswordResetController';
import RegisterController from 'src/controllers/auth/RegisterController';
import { Router } from 'express';
import { authenticateToken } from 'src/utils/helpers';
import multer from 'multer';
import passport from 'passport';
import { createRateLimiter } from 'src/middleware/rateLimiter';
import { rateLimitConfigs } from 'src/middleware/rateLimiter';

const router = Router();
const upload = multer({ dest: 'public/media' })

// Rate limiter for auth endpoints: strict limits for unauthenticated requests
const authRateLimiter = createRateLimiter({
    ...rateLimitConfigs.auth,
    keyGenerator: (req) => `auth-ip-${req.ip}`,
});
const otpRequestRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyGenerator: (req) => `otp-request-ip-${req.ip}`,
});
const otpVerificationRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
    keyGenerator: (req) => `otp-verify-ip-${req.ip}-${req.originalUrl.split('?')[0]}`,
});
const otpResendRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyGenerator: (req) => `otp-resend-ip-${req.ip}`,
});
const otpResendOnlyRateLimiter = (req: Parameters<typeof otpResendRateLimiter>[0], res: Parameters<typeof otpResendRateLimiter>[1], next: Parameters<typeof otpResendRateLimiter>[2]) => {
    if (req.body?.resend === true || req.body?.resend === 'true') {
        return otpResendRateLimiter(req, res, next);
    }
    next();
};

router.post('/auth/signup', upload.none(), authRateLimiter, new RegisterController().create);
router.post('/auth/login', upload.none(), authRateLimiter, new LoginController().create);

router.put('/account/verify/:type', upload.none(), otpVerificationRateLimiter, otpResendOnlyRateLimiter, authenticateToken, new RegisterController().update);
router.delete('/account/logout', authenticateToken, new LoginController().delete);

router.put('/auth/password/reset', upload.none(), otpVerificationRateLimiter, new PasswordResetController().update);
router.post('/auth/password/reset', upload.none(), otpRequestRateLimiter, new PasswordResetController().create);

router.get('/auth/google', passport.authenticate('google'));
router.get('/auth/facebook', passport.authenticate('facebook'));
router.get(
    '/auth/:type/callback',
    (req, res, next) => passport.authenticate(req.params.type, { session: false })(req, res, next),
    new LoginController().oauth
);
export default router;
