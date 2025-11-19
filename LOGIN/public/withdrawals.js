/**
 * ======================================================
 * Withdrawals Management – JavaScript
 * ======================================================
 */

// ---------------------------------------------
// 1) حماية الصفحة - التحقق من التوكن
// ---------------------------------------------
document.addEventListener('DOMContentLoaded', async function() {
  // التأكد من أن requireAuth متاحة
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    window.location.replace("/index.html?error=login_required");
    return;
  }

  // استخدام دالة التحقق الموحدة
  const authValid = await requireAuth();
  
  if (!authValid) {
    return;
  }

  // التحقق من الصلاحيات - الموظفون العاديون يوجهون إلى البصمة
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const regularEmployeeRoles = [
        'employee',
        'waiter',
        'captain',
        'cleaner',
        'hall_manager',
        'hall_captain',
        'receptionist',
        'garage_employee',
        'garage_manager'
      ];
      
      if (regularEmployeeRoles.includes(user.role)) {
        window.location.replace("/attendance.html");
        return;
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
    }
  }

  // ✅ التوكن صحيح - تهيئة الصفحة
  initializeWithdrawals();
});

// تهيئة صفحة السحوبات
function initializeWithdrawals() {
  // إعداد event listeners
  setupListeners();
  
  // تحميل البيانات
  loadWithdrawalsPage();
}

// ---------------------------------------------
// 2) API Helper
// ---------------------------------------------
async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  
  if (!token) {
    console.error("❌ لا يوجد توكن");
    alert("جلسة منتهية. يرجى تسجيل الدخول مرة أخرى");
    window.location.href = "/index.html";
    return { status: "error", message: "لا يوجد توكن" };
  }

  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, config);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("❌ خطأ في API:", error);
    return { status: "error", message: error.message };
  }
}

// ---------------------------------------------
// 3) إعداد Event Listeners
// ---------------------------------------------
function setupListeners() {
  // زر مسح QR Code
  const scanQRBtn = document.getElementById("scanQRBtn");
  if (scanQRBtn) {
    scanQRBtn.addEventListener("click", () => {
      openScanQRModal();
    });
  }

  // زر إلغاء مسح QR Code
  const cancelScan = document.getElementById("cancelScan");
  if (cancelScan) {
    cancelScan.addEventListener("click", () => {
      // إيقاف الماسح
      if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
          html5QrcodeScanner.clear();
          html5QrcodeScanner = null;
        }).catch(() => {
          // تجاهل الأخطاء
        });
      }

      const modal = document.getElementById("scanQRModal");
      if (modal) {
        modal.classList.remove("active");
        // مسح الحقول
        document.getElementById("withdrawalNotes").value = "";
        document.getElementById("scannedInfo").style.display = "none";
        document.getElementById("saveScan").style.display = "none";
        scannedQRData = null;
      }
    });
  }

  // إغلاق modal عند النقر خارجها
  const scanQRModal = document.getElementById("scanQRModal");
  if (scanQRModal) {
    scanQRModal.addEventListener("click", (e) => {
      if (e.target === scanQRModal) {
        // إيقاف الماسح
        if (html5QrcodeScanner) {
          html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
          }).catch(() => {
            // تجاهل الأخطاء
          });
        }
        scanQRModal.classList.remove("active");
        document.getElementById("scannedInfo").style.display = "none";
        document.getElementById("saveScan").style.display = "none";
        scannedQRData = null;
      }
    });
  }
}

// ---------------------------------------------
// 4) تحميل صفحة السحوبات
// ---------------------------------------------
async function loadWithdrawalsPage() {
  await Promise.all([
    loadKPIs(),
    loadTable(),
    loadRecentWithdrawals()
  ]);
}

// ---------------------------------------------
// 5) KPI Cards
// ---------------------------------------------
async function loadKPIs() {
  try {
    const res = await API("GET", "/api/withdrawals/stats/summary");
    
    if (res.status === "success" && res.data) {
      document.getElementById("kpiTotalWithdrawals").textContent = res.data.total_withdrawals || 0;
      document.getElementById("kpiTotalQuantity").textContent = (res.data.total_quantity || 0).toFixed(2);
      document.getElementById("kpiUniqueUsers").textContent = res.data.unique_users || 0;
      document.getElementById("kpiUniqueProductions").textContent = res.data.unique_productions || 0;
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل KPIs:", error);
  }
}

// ---------------------------------------------
// 6) جدول السحوبات
// ---------------------------------------------
async function loadTable() {
  try {
    const startDate = document.getElementById("filterStartDate")?.value || "";
    const endDate = document.getElementById("filterEndDate")?.value || "";
    const recipeName = document.getElementById("filterRecipe")?.value || "";

    let endpoint = "/api/withdrawals?limit=100";
    if (startDate) endpoint += `&start_date=${startDate}`;
    if (endDate) endpoint += `&end_date=${endDate}`;

    const res = await API("GET", endpoint);

    const tbody = document.querySelector("#withdrawalsTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      let withdrawals = res.data;

      // فلترة حسب اسم الوصفة (client-side)
      if (recipeName) {
        withdrawals = withdrawals.filter(w => 
          (w.item_name || w.name || "").toLowerCase().includes(recipeName.toLowerCase())
        );
      }

      withdrawals.forEach((withdrawal) => {
        const row = document.createElement("tr");

        const withdrawalDate = withdrawal.withdrawal_date 
          ? new Date(withdrawal.withdrawal_date) 
          : null;
        const productionDate = withdrawal.production_date 
          ? new Date(withdrawal.production_date) 
          : null;
        const expiryDate = withdrawal.expiry_date 
          ? new Date(withdrawal.expiry_date) 
          : null;

        const isExpired = expiryDate && expiryDate < new Date();

        row.innerHTML = `
          <td>${withdrawal.item_name || withdrawal.name || '—'}</td>
          <td>${withdrawal.username || 'غير معروف'}</td>
          <td>${withdrawal.withdrawal_quantity || '—'}</td>
          <td>${withdrawalDate ? withdrawalDate.toLocaleString('ar-EG') : '—'}</td>
          <td>${productionDate ? productionDate.toLocaleDateString('ar-EG') : '—'}</td>
          <td style="color: ${isExpired ? '#ff6b7a' : '#00ff88'}">
            ${expiryDate ? expiryDate.toLocaleDateString('ar-EG') : '—'}
            ${isExpired ? ' ⚠️' : ''}
          </td>
          <td>${withdrawal.notes || '—'}</td>
        `;

        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>لا توجد سحوبات</td></tr>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل السحوبات:", error);
    const tbody = document.querySelector("#withdrawalsTable tbody");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>حدث خطأ في تحميل البيانات</td></tr>";
    }
  }
}

// ---------------------------------------------
// 7) آخر السحوبات
// ---------------------------------------------
async function loadRecentWithdrawals() {
  try {
    const res = await API("GET", "/api/withdrawals?limit=5");

    const list = document.getElementById("recentWithdrawals");
    if (!list) return;

    list.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      res.data.forEach((withdrawal) => {
        const li = document.createElement("li");
        const date = withdrawal.withdrawal_date 
          ? new Date(withdrawal.withdrawal_date).toLocaleDateString('ar-EG') 
          : '—';
        li.textContent = `${withdrawal.username || 'غير معروف'} - ${withdrawal.item_name || withdrawal.name || '—'} (${withdrawal.withdrawal_quantity}) - ${date}`;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = "<li>لا توجد سحوبات حديثة</li>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل آخر السحوبات:", error);
  }
}

// متغيرات QR Scanner
let html5QrcodeScanner = null;
let scannedQRData = null;

// ---------------------------------------------
// 8) فتح modal مسح QR Code
// ---------------------------------------------
function openScanQRModal() {
  const modal = document.getElementById("scanQRModal");
  if (modal) {
    modal.classList.add("active");
    
    // إخفاء معلومات المسح السابقة
    document.getElementById("scannedInfo").style.display = "none";
    document.getElementById("saveScan").style.display = "none";
    scannedQRData = null;
    
    // بدء الماسح الضوئي
    startQRScanner();
  }
}

// ---------------------------------------------
// بدء QR Scanner
// ---------------------------------------------
function startQRScanner() {
  const qrReader = document.getElementById("qr-reader");
  if (!qrReader) return;

  // تنظيف الماسح السابق
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
  }

  // إنشاء ماسح جديد
  html5QrcodeScanner = new Html5Qrcode("qr-reader");
  
  html5QrcodeScanner.start(
    { facingMode: "environment" }, // استخدام الكاميرا الخلفية
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    (decodedText, decodedResult) => {
      // تم مسح QR Code بنجاح
      console.log("✅ تم مسح QR Code:", decodedText);
      handleQRCodeScanned(decodedText);
    },
    (errorMessage) => {
      // تجاهل أخطاء المسح المستمرة
    }
  ).catch((err) => {
    console.error("❌ خطأ في بدء الماسح:", err);
    alert("❌ خطأ في تشغيل الكاميرا. تأكد من السماح بالوصول إلى الكاميرا.");
  });
}

// ---------------------------------------------
// معالجة QR Code الممسوح
// ---------------------------------------------
function handleQRCodeScanned(qrCodeString) {
  try {
    // إيقاف الماسح
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop();
    }

    // تحليل بيانات QR Code
    let qrData;
    try {
      qrData = JSON.parse(qrCodeString);
    } catch (parseErr) {
      alert("❌ بيانات QR Code غير صحيحة");
      return;
    }

    scannedQRData = qrData;

    // عرض معلومات الإنتاج
    const scannedInfo = document.getElementById("scannedInfo");
    const scannedInfoContent = document.getElementById("scannedInfoContent");
    const saveBtn = document.getElementById("saveScan");

    if (scannedInfo && scannedInfoContent && saveBtn) {
      scannedInfoContent.innerHTML = `
        <p><strong>اسم الوصفة:</strong> ${qrData.recipe_name || '—'}</p>
        <p><strong>الكمية المنتجة:</strong> ${qrData.production_quantity || '—'}</p>
        <p><strong>وزن البورشن:</strong> ${qrData.portion_weight || '—'}</p>
        <p><strong>تاريخ الإنتاج:</strong> ${qrData.production_date ? new Date(qrData.production_date).toLocaleDateString('ar-EG') : '—'}</p>
        <p><strong>تاريخ الانتهاء:</strong> ${qrData.expiry_date ? new Date(qrData.expiry_date).toLocaleDateString('ar-EG') : '—'}</p>
        <p style="color: #00ff88; font-weight: bold; margin-top: 10px;">سيتم تسجيل سحب 1 بورشن تلقائياً</p>
      `;
      scannedInfo.style.display = "block";
      saveBtn.style.display = "block";
    }
  } catch (error) {
    console.error("❌ خطأ في معالجة QR Code:", error);
    alert("❌ خطأ في معالجة QR Code: " + error.message);
  }
}

// ---------------------------------------------
// 9) معالجة مسح QR Code
// ---------------------------------------------
async function handleScanQR() {
  try {
    if (!scannedQRData) {
      alert("⚠️ يرجى مسح QR Code أولاً");
      return;
    }

    const notes = document.getElementById("withdrawalNotes").value.trim();

    // تعطيل الزر أثناء المعالجة
    const saveBtn = document.getElementById("saveScan");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "⏳ جاري التسجيل...";
    }

    console.log("📤 إرسال طلب تسجيل السحب");

    // استخدام وزن البورشن ككمية السحب (1 بورشن = portion_weight)
    const withdrawalQuantity = scannedQRData.portion_weight || 1;

    const res = await API("POST", "/api/withdrawals/scan", {
      qr_code_data: scannedQRData,
      withdrawal_quantity: withdrawalQuantity, // كمية تلقائية = وزن البورشن
      notes: notes || null
    });

    console.log("📥 استجابة السيرفر:", res);

    if (res.status === "success") {
      // إغلاق modal
      const modal = document.getElementById("scanQRModal");
      if (modal) {
        modal.classList.remove("active");
      }

      // إغلاق الماسح
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
      }

      // مسح الحقول
      document.getElementById("withdrawalNotes").value = "";
      scannedQRData = null;
      
      // إخفاء المعلومات
      document.getElementById("scannedInfo").style.display = "none";
      document.getElementById("saveScan").style.display = "none";

      alert("✅ تم تسجيل السحب بنجاح!");

      // إعادة تحميل البيانات
      await loadWithdrawalsPage();
    } else {
      const errorMsg = res.message || "حدث خطأ أثناء تسجيل السحب";
      console.error("❌ خطأ من السيرفر:", errorMsg);
      alert("❌ خطأ: " + errorMsg);
      
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "✅ تسجيل السحب";
      }
    }
  } catch (error) {
    console.error("❌ خطأ في تسجيل السحب:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + error.message);
    
    const saveBtn = document.getElementById("saveScan");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "✅ تسجيل السحب";
    }
  }
}

// ---------------------------------------------
// 10) تطبيق الفلاتر
// ---------------------------------------------
function applyFilters() {
  loadTable();
}

// ---------------------------------------------
// 11) مسح الفلاتر
// ---------------------------------------------
function clearFilters() {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  document.getElementById("filterRecipe").value = "";
  loadTable();
}

