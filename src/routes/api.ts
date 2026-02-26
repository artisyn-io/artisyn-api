import { Request, Response, Router } from "express";

import AccountLinkingController from 'src/controllers/AccountLinkingController';
import CategoryController from 'src/controllers/CategoryController';
import DataExportController from 'src/controllers/DataExportController';
import PreferencesController from 'src/controllers/PreferencesController';
import PrivacySettingsController from 'src/controllers/PrivacySettingsController';
import ProfileController from 'src/controllers/ProfileController';
import ReviewController from "src/controllers/ReviewController";
import SearchController from "src/controllers/SearchController";
import { authenticateToken } from "src/utils/helpers";

const router = Router();
const reviewController = new ReviewController();
const searchController = new SearchController();

router.get("/", (req: Request, res: Response) => {
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

// Search routes (Public)
router.get("/search", searchController.index);
router.get("/search/suggestions", searchController.suggestions);


// Artisan search and listing endpoints
router.use("/artisans", (await import("./api/artisans")).default);

// Listing applications management
router.use("/", (await import("./api/applications")).default);

// Get reviews for a specific curator
router.get("/curators/:id/reviews", reviewController.curatorReviews);

// Profile routes
router.get('/profile', new ProfileController().getProfile);
router.post('/profile', new ProfileController().updateProfile);
router.get('/profile/completion', new ProfileController().getProfileCompletion);
router.get('/profile/:userId/public', new ProfileController().getPublicProfile);
router.delete('/profile', new ProfileController().deleteProfile);

// Preferences routes
router.get('/preferences', authenticateToken, new PreferencesController().getPreferences);
router.post('/preferences', authenticateToken, new PreferencesController().updatePreferences);
router.post('/preferences/notifications', authenticateToken, new PreferencesController().updateNotifications);
router.post('/preferences/two-factor/toggle', authenticateToken, new PreferencesController().toggleTwoFactor);
router.post('/preferences/reset', authenticateToken, new PreferencesController().resetPreferences);

// Privacy Settings routes
router.get('/privacy', authenticateToken, new PrivacySettingsController().getPrivacySettings);
router.post('/privacy', authenticateToken, new PrivacySettingsController().updatePrivacySettings);
router.post('/privacy/visibility', authenticateToken, new PrivacySettingsController().updateProfileVisibility);
router.post('/privacy/block', authenticateToken, new PrivacySettingsController().blockUser);
router.post('/privacy/unblock', authenticateToken, new PrivacySettingsController().unblockUser);
router.get('/privacy/blocklist', authenticateToken, new PrivacySettingsController().getBlockList);
router.post('/privacy/retention', authenticateToken, new PrivacySettingsController().updateDataRetention);

// Account Linking routes
router.get('/account-links', authenticateToken, new AccountLinkingController().getLinkedAccounts);
router.post('/account-links', authenticateToken, new AccountLinkingController().linkAccount);
router.get('/account-links/:provider', authenticateToken, new AccountLinkingController().checkProviderLinked);
router.delete('/account-links/:provider', authenticateToken, new AccountLinkingController().unlinkAccount);

// Data Export routes (GDPR compliance)
router.post('/data-export/request', authenticateToken, new DataExportController().requestDataExport);
router.get('/data-export/requests', authenticateToken, new DataExportController().getExportRequests);
router.get('/data-export/:requestId/status', authenticateToken, new DataExportController().getExportStatus);
router.get('/data-export/:requestId/download', authenticateToken, new DataExportController().downloadExport);
router.post('/data-export/:requestId/cancel', authenticateToken, new DataExportController().cancelExport);
router.post('/account/deletion-request', authenticateToken, new DataExportController().requestAccountDeletion);
router.post('/account/cancel-deletion', authenticateToken, new DataExportController().cancelAccountDeletion);

export default router; 
