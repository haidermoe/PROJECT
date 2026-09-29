const express = require("express");
const router = express.Router();
const payrollController = require("./payrollController");
const { authMiddleware, requireRole } = require("../auth/authMiddleware");

// All routes require HR or Admin
router.use(authMiddleware);
router.use(requireRole('admin', 'hr'));

// Employee Salaries 
router.get("/salaries", payrollController.getSalaries);
router.put("/salaries/:user_id", payrollController.updateSalary);

// Payroll Periods
router.post("/periods", payrollController.createPeriod);
router.get("/periods", payrollController.getPeriods);
router.put("/periods/:id/close", payrollController.closePeriod);

// Generation and Records
router.post("/generate/:period_id", payrollController.generatePayroll);
router.get("/records/:period_id", payrollController.getPayrollRecords);

module.exports = router;
