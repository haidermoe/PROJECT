/**
 * ======================================================
 * اتصال قاعدة بيانات المصادقة - Auth Database Connection
 * ======================================================
 * 
 * هذا الملف يحتوي على اتصال معزول تماماً لقاعدة بيانات المصادقة
 * لا يمكن الوصول إلى هذه القاعدة إلا من خلال هذا الملف
 * 
 * مبدأ العزل: قاعدة بيانات المصادقة منفصلة تماماً عن قاعدة البيانات الرئيسية
 */

const mysql = require('mysql2/promise');
const { authDbConfig } = require('../config/database');

/**
 * Pool اتصال قاعدة بيانات المصادقة
 * معزول تماماً عن قاعدة البيانات الرئيسية
 */
const authPool = mysql.createPool(authDbConfig);

/**
 * اختبار الاتصال بقاعدة بيانات المصادقة
 */
async function testAuthConnection() {
  try {
    const connection = await authPool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ تم الاتصال بقاعدة بيانات المصادقة (auth_db) بنجاح');
    return true;
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة بيانات المصادقة:', error.message);
    return false;
  }
}

/**
 * إغلاق جميع الاتصالات (للاستخدام عند إيقاف التطبيق)
 */
async function closeAuthConnection() {
  try {
    await authPool.end();
    console.log('✅ تم إغلاق اتصالات قاعدة بيانات المصادقة');
  } catch (error) {
    console.error('❌ خطأ في إغلاق اتصالات قاعدة بيانات المصادقة:', error.message);
  }
}

/**
 * الحصول على اتصال من الـ pool
 * ⚠️ مهم: يجب إعادة الاتصال بعد الاستخدام
 */
async function getAuthConnection() {
  return await authPool.getConnection();
}

/**
 * تنفيذ استعلام على قاعدة بيانات المصادقة
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
async function executeAuthQuery(query, params = []) {
  try {
    const [rows] = await authPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ خطأ في تنفيذ استعلام قاعدة بيانات المصادقة:', error.message);
    throw error;
  }
}

// اختبار الاتصال عند تحميل الملف
testAuthConnection();

module.exports = {
  authPool,
  testAuthConnection,
  closeAuthConnection,
  getAuthConnection,
  executeAuthQuery
};

