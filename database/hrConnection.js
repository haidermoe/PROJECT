/**
 * ======================================================
 * اتصال قاعدة بيانات الموارد البشرية - HR Database Connection
 * ======================================================
 * 
 * هذا الملف يحتوي على اتصال معزول حصرياً بقاعدة بيانات الموارد البشرية (hr_db).
 * 
 * مبدأ العزل: لا يوجد أي تشابك مع بيانات التطبيق (المخزون) أو المصادقة.
 */

const mysql = require('mysql2/promise');
const { hrDbConfig } = require('../config/database');

/**
 * Pool اتصال قاعدة بيانات الموارد البشرية
 * معزول تماماً لأغراض تأمين بيانات الموظفين والرواتب
 */
const hrPool = mysql.createPool(hrDbConfig);

/**
 * اختبار الاتصال
 */
async function testHrConnection() {
  try {
    const connection = await hrPool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ تم الاتصال بقاعدة بيانات الموارد البشرية (hr_db) بنجاح');
    return true;
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة بيانات الموارد البشرية:', error.message);
    return false;
  }
}

/**
 * إغلاق الاتصالات
 */
async function closeHrConnection() {
  try {
    await hrPool.end();
    console.log('✅ تم إغلاق اتصالات قاعدة بيانات الموارد البشرية');
  } catch (error) {
    console.error('❌ خطأ في إغلاق اتصالات قاعدة بيانات الموارد البشرية:', error.message);
  }
}

/**
 * تنفيذ استعلام آمن
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 */
async function executeHrQuery(query, params = []) {
  try {
    const [rows] = await hrPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ خطأ في تنفيذ استعلام الموارد البشرية:', error.message);
    throw error;
  }
}

// اختبار الاتصال عند تحميل الملف
// testHrConnection(); // Can be invoked by server.js at initialization

module.exports = {
  hrPool,
  testHrConnection,
  closeHrConnection,
  executeHrQuery
};
