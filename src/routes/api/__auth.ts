import LoginController from '../../controllers/auth/LoginController';
import PasswordResetController from '../../controllers/auth/PasswordResetController';
import RegisterController from '../../controllers/auth/RegisterController';
import { Router } from 'express';
import { authenticateToken } from '../../utils/helpers';
import multer from 'multer';
import passport from 'passport';

const router = Router();
const upload = multer({ dest: 'public/media' })

router.post('/auth/signup', upload.none(), new RegisterController().create);
router.post('/auth/login', upload.none(), new LoginController().create);

router.put('/account/verify/:type', upload.none(), authenticateToken, new RegisterController().update);
router.delete('/account/logout', authenticateToken, new LoginController().delete);

router.put('/auth/password/reset', upload.none(), new PasswordResetController().update);
router.post('/auth/password/reset', upload.none(), new PasswordResetController().create);

router.get('/auth/google', passport.authenticate('google'));
router.get('/auth/facebook', passport.authenticate('facebook'));
router.get(
    '/auth/:type/callback',
    (req, res, next) => passport.authenticate(req.params.type, { session: false })(req, res, next),
    new LoginController().oauth
);
export default router;
