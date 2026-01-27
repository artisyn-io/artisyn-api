import CategoryController from 'src/controllers/CategoryController';
import ProfileController from 'src/controllers/ProfileController';
import PreferencesController from 'src/controllers/PreferencesController';
import PrivacySettingsController from 'src/controllers/PrivacySettingsController';
import AccountLinkingController from 'src/controllers/AccountLinkingController';
import DataExportController from 'src/controllers/DataExportController';
import { Router } from 'express';
import ReviewController from "src/controllers/ReviewController";
import { Router } from "express";

const router = Router();
const reviewController = new ReviewController();

router.get("/", (req, res) => {
  res.json({
    data: {
      message: "Welcome to Artisyn API",
      version: "1.0.0",
    },
    status: "success",
    message: "OK",
    code: 200,
  });
});

// Categories routes
router.get('/categories', new CategoryController().index);
router.get('/categories/:id', new CategoryController().show);
router.get("/categories", new CategoryController().index);


// Get reviews for a specific artisan
router.get("/artisans/:id/reviews", reviewController.artisanReviews);

// Get reviews for a specific curator
router.get("/curators/:id/reviews", reviewController.curatorReviews);

// Profile routes
router.get('/profile', new ProfileController().getProfile);
router.post('/profile', new ProfileController().updateProfile);
router.get('/profile/completion', new ProfileController().getProfileCompletion);
router.get('/profile/:userId/public', new ProfileController().getPublicProfile);
router.delete('/profile', new ProfileController().deleteProfile);

// Preferences routes
router.get('/preferences', new PreferencesController().getPreferences);
router.post('/preferences', new PreferencesController().updatePreferences);
router.post('/preferences/notifications', new PreferencesController().updateNotifications);
router.post('/preferences/two-factor/toggle', new PreferencesController().toggleTwoFactor);
router.post('/preferences/reset', new PreferencesController().resetPreferences);

// Privacy Settings routes
router.get('/privacy', new PrivacySettingsController().getPrivacySettings);
router.post('/privacy', new PrivacySettingsController().updatePrivacySettings);
router.post('/privacy/visibility', new PrivacySettingsController().updateProfileVisibility);
router.post('/privacy/block', new PrivacySettingsController().blockUser);
router.post('/privacy/unblock', new PrivacySettingsController().unblockUser);
router.get('/privacy/blocklist', new PrivacySettingsController().getBlockList);
router.post('/privacy/retention', new PrivacySettingsController().updateDataRetention);

// Account Linking routes
router.get('/account-links', new AccountLinkingController().getLinkedAccounts);
router.post('/account-links', new AccountLinkingController().linkAccount);
router.get('/account-links/:provider', new AccountLinkingController().getAccountLink);
router.delete('/account-links/:provider', new AccountLinkingController().unlinkAccount);
router.post('/account-links/check-availability', new AccountLinkingController().checkProviderAvailability);
router.post('/account-links/verify', new AccountLinkingController().verifyAccountLink);

// Data Export routes (GDPR compliance)
router.post('/data-export/request', new DataExportController().requestDataExport);
router.get('/data-export/requests', new DataExportController().getExportRequests);
router.get('/data-export/:requestId/status', new DataExportController().getExportStatus);
router.get('/data-export/:requestId/download', new DataExportController().downloadExport);
router.post('/data-export/:requestId/cancel', new DataExportController().cancelExport);
router.post('/account/deletion-request', new DataExportController().requestAccountDeletion);
router.post('/account/cancel-deletion', new DataExportController().cancelAccountDeletion);

export default router;
