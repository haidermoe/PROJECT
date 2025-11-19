/**
 * ======================================================
 * Recipe Production Page - JavaScript
 * ======================================================
 */

// التحقق من التوكن عند تحميل الصفحة
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

  // ✅ التوكن صحيح - تحميل بيانات الإنتاج
  loadProductionData();
});

// جلب بيانات الإنتاج من URL
function getProductionIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// تحميل بيانات الإنتاج
async function loadProductionData() {
  try {
    const productionId = getProductionIdFromURL();
    
    if (!productionId) {
      alert('❌ رقم الإنتاج غير موجود في الرابط');
      window.location.href = '/recipes.html';
      return;
    }

    console.log('📥 جاري تحميل بيانات الإنتاج:', productionId);

    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("لا يوجد توكن. يرجى تسجيل الدخول مرة أخرى");
    }

    const response = await fetch(`/api/recipes/productions/${productionId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`خطأ ${response.status}: ${response.statusText}`);
    }

    const res = await response.json();

    if (res.status === "success" && res.data) {
      populateProductionData(res.data);
    } else {
      throw new Error(res.message || 'فشل تحميل بيانات الإنتاج');
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل بيانات الإنتاج:", error);
    alert("❌ حدث خطأ في تحميل بيانات الإنتاج: " + error.message);
    window.location.href = '/recipes.html';
  }
}

// ملء بيانات الإنتاج في الصفحة
function populateProductionData(data) {
  console.log('📊 بيانات الإنتاج:', data);

  // Header Info
  document.getElementById('recipeReference').textContent = data.reference || '—';
  document.getElementById('recipeVersion').textContent = data.version || '001';
  document.getElementById('recipeEdition').textContent = data.edition || '1';

  // Recipe Name
  const recipeName = data.item_name || data.name || '—';
  const recipeNameEl = document.getElementById('recipeItemName');
  if (recipeNameEl) {
    recipeNameEl.textContent = recipeName;
    recipeNameEl.style.color = '#000';
  }
  document.getElementById('recipeItemNameDetail').textContent = recipeName;

  // Production Info Cards
  const productionQtyEl = document.getElementById('productionQuantity');
  const portionWeightEl = document.getElementById('portionWeight');
  const productionDateEl = document.getElementById('productionDate');
  const expiryDateEl = document.getElementById('expiryDate');
  
  if (productionQtyEl) {
    productionQtyEl.textContent = data.production_quantity || '—';
    productionQtyEl.style.color = '#000';
  }
  
  if (portionWeightEl) {
    portionWeightEl.textContent = data.portion_weight || '—';
    portionWeightEl.style.color = '#000';
  }
  
  const productionDate = data.production_date ? new Date(data.production_date) : null;
  const expiryDate = data.expiry_date ? new Date(data.expiry_date) : null;
  
  if (productionDate && productionDateEl) {
    const dateStr = productionDate.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    productionDateEl.textContent = dateStr;
    productionDateEl.style.color = '#000';
    document.getElementById('productionDateDetail').textContent = productionDate.toLocaleDateString('ar-EG');
  }
  
  if (expiryDate && expiryDateEl) {
    const dateStr = expiryDate.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    expiryDateEl.textContent = dateStr;
    expiryDateEl.style.color = '#000';
    document.getElementById('expiryDateDetail').textContent = expiryDate.toLocaleDateString('ar-EG');
  }

  // Item Details
  document.getElementById('productionQuantityDetail').textContent = data.production_quantity || '—';
  document.getElementById('portionWeightDetail').textContent = data.portion_weight || '—';

  // Ingredients Table
  const ingredientsTableBody = document.getElementById('ingredientsTableBody');
  if (data.calculated_ingredients && Array.isArray(data.calculated_ingredients) && data.calculated_ingredients.length > 0) {
    ingredientsTableBody.innerHTML = '';
    data.calculated_ingredients.forEach((ingredient, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${ingredient.ingredient_name || '—'}</td>
        <td>${ingredient.original_quantity || '—'}</td>
        <td style="font-weight: bold; color: #0066cc;">${ingredient.calculated_quantity || '—'}</td>
      `;
      ingredientsTableBody.appendChild(row);
    });
  } else {
    ingredientsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">لا توجد مكونات</td></tr>';
  }

  // QR Codes (جميع البورتشنات)
  const qrCodeImage = document.getElementById('qrCodeImage');
  if (data.qr_codes && Array.isArray(data.qr_codes) && data.qr_codes.length > 0) {
    // عرض جميع QR Codes
    let qrCodesHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">';
    data.qr_codes.forEach((qr, index) => {
      qrCodesHTML += `
        <div style="text-align: center; padding: 10px; background: white; border-radius: 8px;">
          <p style="font-size: 12px; color: #333; margin-bottom: 5px; font-weight: bold;">بورشن ${qr.portion_number}</p>
          <img src="${qr.qr_code_image}" alt="QR Code ${qr.portion_number}" style="max-width: 100%; height: auto;" />
        </div>
      `;
    });
    qrCodesHTML += '</div>';
    qrCodeImage.innerHTML = qrCodesHTML;
  } else if (data.qr_code_image) {
    // للتوافق مع البيانات القديمة
    qrCodeImage.innerHTML = `<img src="${data.qr_code_image}" alt="QR Code" />`;
  } else if (data.qr_code_data) {
    // إنشاء QR Code من البيانات
    qrCodeImage.innerHTML = '<p>QR Code غير متاح</p>';
  }
}

