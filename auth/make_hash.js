// ======================================================
// سكريبت لتشفير كلمة المرور باستخدام bcrypt
// تشغيل: node auth/make_hash.js
// ======================================================

const bcrypt = require('bcrypt');

async function make() {
  const password = "123456"; // ⚙️ غيّر كلمة المرور هنا
  const hash = await bcrypt.hash(password, 10);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("كلمة المرور:", password);
  console.log("التشفير (Hash):", hash);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

make();

