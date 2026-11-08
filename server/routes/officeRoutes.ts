import { Router } from 'express';
import { officeController } from '../controllers/officeController';

const router = Router();

// Staff Directory
router.get('/staff', officeController.getStaff);

// Executive Task Dispatch & Manual Orders
router.post('/dispatch', officeController.dispatchTask);

// Draft Revision Loop
router.post('/revise', officeController.reviseTask);

// Autonomous Proactive Research Queue & Trigger
router.get('/proactive', officeController.getProactive);
router.post('/proactive/scan', officeController.triggerScan);
router.post('/proactive-scan', officeController.triggerScan);

// 06.00 AM Content Creator Autonomous Pipeline
router.post('/creator/daily-routine', officeController.dailyCreatorRoutine);

export default router;
