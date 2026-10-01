/************************************************************
 *  Server.js – Main Application Server (Clean Architecture)
 *  مع عزل كامل بين قواعد البيانات للأمان
 ************************************************************/

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// استيراد إعدادات الأمان
const { corsConfig } = require('./config/security');
const { sanitizeRequest, errorHandler, logAccess } = require('./middleware/security');

// استيراد اتصالات قواعد البيانات (معزولة)
const { testAuthConnection, closeAuthConnection } = require('./database/authConnection');
const { testAppConnection, closeAppConnection, appPool } = require('./database/appConnection');
const { testHrConnection, closeHrConnection, hrPool } = require('./database/hrConnection');

const app = express();
const PORT = process.env.PORT || 3000;


/************************************************************
 *  Middleware Basics
 ************************************************************/
app.use(cors(corsConfig));
app.use(express.json({ limit: '10mb' })); // حد أقصى لحجم البيانات
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware للأمان
app.use(sanitizeRequest); // تنظيف البيانات الواردة
app.use(logAccess); // تسجيل محاولات الوصول


/************************************************************
 *  1) اختبار اتصالات قواعد البيانات (معزولة)
  ************************************************************/
async function initializeDatabases() {
  console.log('🔄 جاري اختبار اتصالات قواعد البيانات...');
  
  const authConnected = await testAuthConnection();
  const appConnected = await testAppConnection();
  const hrConnected = await testHrConnection();
  
  if (!authConnected || !appConnected || !hrConnected) {
    console.error('❌ فشل الاتصال بإحدى قواعد البيانات');
    process.exit(1);
  }
  
  console.log('✅ جميع اتصالات قواعد البيانات جاهزة');
}

// تهيئة قواعد البيانات
initializeDatabases().then(async () => {
  try {
    const { initAccountingAndPosTables } = require('./database/initAccountingAndPos');
    await initAccountingAndPosTables();
  } catch (migErr) {
    console.warn('⚠️ خطأ في تهيئة جداول المحاسبة والـ POS:', migErr.message);
  }

  // بدء المهام الخلفية التلقائية بعد نجاح الاتصال
  const { startAutomations } = require('./api/automationService');
  startAutomations();
});

// توفير اتصال قاعدة البيانات الرئيسية للـ routes القديمة (للتوافق)
app.use((req, res, next) => {
  req.db = appPool; // استخدام pool بدلاً من connection
  next();
});


/************************************************************
 *  2) ربط مسارات النظام
  ************************************************************/

// مسارات تسجيل الدخول و إدارة المستخدمين (معزولة في auth/)
app.use('/auth', require('./auth/authRoutes'));

// مسارات الداشبورد (المخزن – KPI – الأحصائيات)
app.use('/api/dashboard', require('./api/dashboardRoutes'));

// مسارات المخزن (إدارة المواد)
app.use('/api/inventory', require('./api/inventoryRoutes'));

// مسارات الوصفات
app.use('/api/recipes', require('./api/recipesRoutes'));

// مسارات السحوبات
app.use('/api/withdrawals', require('./api/withdrawalsRoutes'));

// مسارات الهدر
app.use('/api/waste', require('./api/wasteRoutes'));

// مسارات البصمة
app.use('/api/attendance', require('./api/attendanceRoutes'));

// مسارات الإجازات
app.use('/api/leaves', require('./api/leavesRoutes'));

// مسارات جداول الدوام
app.use('/api/shifts', require('./api/shiftsRoutes'));

// مسارات الإعدادات (admin only)
app.use('/api/settings', require('./api/settingsRoutes'));

// مسارات توجيه طباعة الأوردرات (POS Print Routing)
app.use('/api/pos', require('./api/printRoutingRoutes'));

// مسارات الموافقات
app.use('/api/approvals', require('./api/approvalRoutes'));

// مسارات الرواتب (النظام القديم أو الانتقالي)
app.use('/api/payroll', require('./api/payrollRoutes'));

// النظام الجديد: مسارات الموارد البشرية المستقلة تماماً (hr_db)
app.use('/api/hr', require('./api/hrRoutes'));

// مسارات الإشعارات
app.use('/api/notifications', require('./api/notificationsRoutes'));

// مسارات المحاسبة وشجرة الحسابات والتحليلات المالية (معايير أودو)
app.use('/api/accounting', require('./api/accountingRoutes'));

// مسارات الصالات ونظام طلبات الويترية (Odoo POS Restaurant)
app.use('/api/pos-restaurant', require('./api/posRestaurantRoutes'));

// مسارات تعدد الشركات والفروع والمخازن واللوجستيات المجمعة
app.use('/api/branches', require('./api/branchesRoutes'));

// استيراد middleware للتحقق من التوكن
const { authMiddleware } = require('./auth/authMiddleware');

// ⚠️ ملاحظة مهمة: التحقق من التوكن يتم في client-side عبر auth-check.js
// لأن التوكن موجود في localStorage (client-side فقط)
// server-side لا يمكنه الوصول إلى localStorage
// لذلك نسمح بتحميل الصفحات، والتحقق يتم في client-side

// إعادة توجيه /dashboard.html إلى /dashboard/dashboard.html
app.get('/dashboard.html', (req, res) => {
  res.redirect('/dashboard/dashboard.html');
});

// Explicitly serve settings.html
app.get('/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'LOGIN/public/settings.html'));
});

// Redirect /settings to /settings.html
app.get('/settings', (req, res) => {
  res.redirect('/settings.html');
});

// Explicitly serve waiter.html & accounting.html
app.get('/waiter.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'LOGIN/public/waiter.html'));
});
app.get('/waiter', (req, res) => {
  res.redirect('/waiter.html');
});

app.get('/accounting.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'LOGIN/public/accounting.html'));
});
app.get('/accounting', (req, res) => {
  res.redirect('/accounting.html');
});

// Explicitly serve branches.html
app.get('/branches.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'LOGIN/public/branches.html'));
});
app.get('/branches', (req, res) => {
  res.redirect('/branches.html');
});

// Health check endpoint (required by Render and other hosting providers)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// معالج 404 للـ API routes (يجب أن يكون قبل express.static)
app.use('/api/*', (req, res) => {
  console.error('❌ 404: API route not found:', req.method, req.path);
  res.status(404).json({
    status: 'error',
    message: 'API route not found'
  });
});

// ⚠️ مهم: صفحة تسجيل الدخول يجب أن تكون متاحة بدون حماية
// تقديم الملفات الثابتة (بعد المسارات المحمية)
app.use(express.static(path.join(__dirname, 'LOGIN/public')));

/************************************************************
 *  3) مسار الاختبار
 ************************************************************/
app.get('/', (req, res) => {
  res.send('🚀 السيرفر الرئيسي شغال! وواجهة LOGIN/public تعمل الآن.');
});


/************************************************************
 *  3) معالج الأخطاء العام
  ************************************************************/
app.use(errorHandler);


/************************************************************
 *  4) تشغيل السيرفر
  ************************************************************/
const server = app.listen(PORT, () => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌍 السيرفر يعمل الآن على: ${baseUrl}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log('🔒 الأمان: عزل كامل بين قواعد البيانات');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});


/************************************************************
 *  5) إغلاق نظيف عند إيقاف السيرفر
  ************************************************************/
process.on('SIGTERM', async () => {
  console.log('🛑 تم استلام إشارة SIGTERM، جاري الإغلاق...');
  server.close(async () => {
    await closeAuthConnection();
    await closeAppConnection();
    await closeHrConnection();
    console.log('✅ تم إغلاق السيرفر بشكل نظيف');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 تم استلام إشارة SIGINT، جاري الإغلاق...');
  server.close(async () => {
    await closeAuthConnection();
    await closeAppConnection();
    await closeHrConnection();
    console.log('✅ تم إغلاق السيرفر بشكل نظيف');
    process.exit(0);
  });
});
