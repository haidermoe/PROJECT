/**
 * ======================================================
 * اتصال قاعدة البيانات الرئيسية - Application Database Connection
 * ======================================================
 * 
 * هذا الملف يحتوي على اتصال معزول لقاعدة البيانات الرئيسية
 * هذه القاعدة تحتوي على بيانات المخزن والوصفات والمعاملات
 * 
 * مبدأ العزل: قاعدة البيانات الرئيسية منفصلة تماماً عن قاعدة بيانات المصادقة
 */

const mysql = require('mysql2/promise');
const { appDbConfig } = require('../config/database');

/**
 * Pool اتصال قاعدة البيانات الرئيسية
 * معزول تماماً عن قاعدة بيانات المصادقة
 */
const appPool = mysql.createPool(appDbConfig);

/**
 * اختبار الاتصال بقاعدة البيانات الرئيسية
 */
async function testAppConnection() {
  try {
    const connection = await appPool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ تم الاتصال بقاعدة البيانات الرئيسية (kitchen_inventory) بنجاح');
    return true;
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة البيانات الرئيسية:', error.message);
    return false;
  }
}

/**
 * إغلاق جميع الاتصالات (للاستخدام عند إيقاف التطبيق)
 */
async function closeAppConnection() {
  try {
    await appPool.end();
    console.log('✅ تم إغلاق اتصالات قاعدة البيانات الرئيسية');
  } catch (error) {
    console.error('❌ خطأ في إغلاق اتصالات قاعدة البيانات الرئيسية:', error.message);
  }
}

/**
 * الحصول على اتصال من الـ pool
 * ⚠️ مهم: يجب إعادة الاتصال بعد الاستخدام
 */
async function getAppConnection() {
  return await appPool.getConnection();
}

/**
 * تنفيذ استعلام على قاعدة البيانات الرئيسية
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
async function executeAppQuery(query, params = []) {
  try {
    const [rows] = await appPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ خطأ في تنفيذ استعلام قاعدة البيانات الرئيسية:', error.message);
    throw error;
  }
}

// اختبار الاتصال عند تحميل الملف
testAppConnection();

module.exports = {
  appPool,
  testAppConnection,
  closeAppConnection,
  getAppConnection,
  executeAppQuery
};

