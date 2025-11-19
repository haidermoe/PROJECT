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
  
  if (!authConnected || !appConnected) {
    console.error('❌ فشل الاتصال بإحدى قواعد البيانات');
    process.exit(1);
  }
  
  console.log('✅ جميع اتصالات قواعد البيانات جاهزة');
}

// تهيئة قواعد البيانات
initializeDatabases();

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

// مسارات الموافقات
app.use('/api/approvals', require('./api/approvalRoutes'));

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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌍 السيرفر يعمل الآن على: http://localhost:${PORT}`);
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
    console.log('✅ تم إغلاق السيرفر بشكل نظيف');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 تم استلام إشارة SIGINT، جاري الإغلاق...');
  server.close(async () => {
    await closeAuthConnection();
    await closeAppConnection();
    console.log('✅ تم إغلاق السيرفر بشكل نظيف');
    process.exit(0);
  });
});
