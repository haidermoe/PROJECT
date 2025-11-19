/**
 * ======================================================
 * Add Recipe Page - JavaScript
 * ======================================================
 */

// التحقق من التوكن عند تحميل الصفحة
// الانتظار حتى يتم تحميل auth-check.js
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔵 بدء تهيئة صفحة إضافة الوصفة...');
  
  // التأكد من أن requireAuth متاحة
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    // إعادة توجيه لتسجيل الدخول
    window.location.replace("/index.html?error=login_required");
    return;
  }

  // استخدام دالة التحقق الموحدة
  const authValid = await requireAuth();
  
  if (!authValid) {
    // تم إعادة التوجيه تلقائياً في requireAuth
    return;
  }

  // التحقق من الصلاحيات (يجب أن يكون مدير أو شيف)
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const userRole = user.role;

      // فقط المدير والشيف يمكنهم إضافة وصفات
      if (userRole !== 'admin' && userRole !== 'kitchen_manager') {
        alert("⚠️ ليس لديك صلاحية لإضافة وصفات");
        window.location.href = "/recipes.html";
        return;
      }
    } catch (e) {
      console.error("خطأ في قراءة بيانات المستخدم:", e);
      window.location.href = "/index.html?error=login_required";
      return;
    }
  }

  // إضافة صف مكون فارغ عند تحميل الصفحة
  addIngredientRow();

  // التركيز على حقل اسم الوصفة
  setTimeout(() => {
    const itemNameInput = document.getElementById("recipeItemName");
    if (itemNameInput) {
      itemNameInput.focus();
    }
  }, 100);

  // Event Listeners
  // زر إضافة مكون
  const addIngredientBtn = document.getElementById("addIngredientBtn");
  if (addIngredientBtn) {
    addIngredientBtn.addEventListener("click", () => {
      addIngredientRow();
    });
  } else {
    console.error("❌ زر إضافة مكون غير موجود!");
  }

  // زر إلغاء
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (confirm("هل أنت متأكد من الإلغاء؟ سيتم فقدان جميع البيانات المدخلة.")) {
        window.location.href = "/recipes.html";
      }
    });
  } else {
    console.error("❌ زر الإلغاء غير موجود!");
  }

  // زر حفظ
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    console.log("✅ تم العثور على زر الحفظ، جاري ربطه...");
    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🔵 تم النقر على زر الحفظ");
      await handleAddRecipe();
    });
    console.log("✅ تم ربط زر الحفظ بنجاح");
  } else {
    console.error("❌ زر الحفظ غير موجود!");
  }
});

// إضافة صف مكون جديد
function addIngredientRow() {
  const tbody = document.getElementById("ingredientsTableBody");
  if (!tbody) return;

  const rowCount = tbody.children.length;
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${rowCount + 1}</td>
    <td>
      <input type="text" class="ingredient-name" placeholder="اسم المكون" autocomplete="off" />
    </td>
    <td>
      <input type="text" class="ingredient-quantity" placeholder="الكمية" autocomplete="off" />
    </td>
    <td>
      <select class="ingredient-unit" autocomplete="off">
        <option value="">اختر الوحدة</option>
        <option value="ML">ML</option>
        <option value="L">L</option>
        <option value="GR">GR</option>
        <option value="KG">KG</option>
        <option value="PC">PC</option>
        <option value="PCS">PCS</option>
        <option value="CUP">CUP</option>
        <option value="TBSP">TBSP</option>
        <option value="TSP">TSP</option>
        <option value="OZ">OZ</option>
        <option value="LB">LB</option>
        <option value="UNIT">UNIT</option>
        <option value="OTHER">أخرى</option>
      </select>
      <input type="text" class="ingredient-unit-custom" placeholder="أدخل الوحدة" style="display:none; margin-top:5px;" autocomplete="off" />
    </td>
    <td>
      <button type="button" class="btn-delete" onclick="removeIngredientRow(this)">🗑</button>
    </td>
  `;
  tbody.appendChild(row);
  
  // إضافة event listener للوحدة المخصصة
  const unitSelect = row.querySelector(".ingredient-unit");
  const unitCustom = row.querySelector(".ingredient-unit-custom");
  if (unitSelect && unitCustom) {
    unitSelect.addEventListener("change", function() {
      if (this.value === "OTHER") {
        unitCustom.style.display = "block";
        unitCustom.required = true;
      } else {
        unitCustom.style.display = "none";
        unitCustom.required = false;
        unitCustom.value = "";
      }
    });
  }
}

// حذف صف مكون
function removeIngredientRow(btn) {
  const row = btn.closest("tr");
  if (row) {
    row.remove();
    // إعادة ترقيم الصفوف
    updateIngredientRowNumbers();
  }
}

// إعادة ترقيم صفوف المكونات
function updateIngredientRowNumbers() {
  const tbody = document.getElementById("ingredientsTableBody");
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll("tr");
  rows.forEach((row, index) => {
    const numberCell = row.querySelector("td:first-child");
    if (numberCell) {
      numberCell.textContent = index + 1;
    }
  });
}

// مسح جميع حقول النموذج
function clearFormFields() {
  // مسح الحقول الأساسية
  const itemNameInput = document.getElementById("recipeItemName");
  const referenceInput = document.getElementById("recipeReference");
  const yieldInput = document.getElementById("recipeYield");
  const portionsInput = document.getElementById("recipePortions");
  const shelfLifeInput = document.getElementById("recipeShelfLife");
  const versionInput = document.getElementById("recipeVersion");
  const editionInput = document.getElementById("recipeEdition");
  const procedureTextarea = document.getElementById("recipeProcedure");
  
  if (itemNameInput) itemNameInput.value = "";
  if (referenceInput) referenceInput.value = "";
  if (yieldInput) yieldInput.value = "";
  if (portionsInput) portionsInput.value = "";
  if (shelfLifeInput) shelfLifeInput.value = "";
  if (versionInput) versionInput.value = "001";
  if (editionInput) editionInput.value = "1";
  if (procedureTextarea) procedureTextarea.value = "";
  
  // مسح جدول المكونات وإضافة صف فارغ واحد
  const tbody = document.getElementById("ingredientsTableBody");
  if (tbody) {
    tbody.innerHTML = "";
    addIngredientRow(); // إضافة صف مكون فارغ واحد
  }
  
  console.log("✅ تم مسح جميع الحقول");
}

// تم نقل Event Listeners إلى DOMContentLoaded الرئيسي أعلاه

// معالجة إضافة وصفة
async function handleAddRecipe() {
  // قراءة القيم مع تسجيل للتشخيص
  const itemNameInput = document.getElementById("recipeItemName");
  
  // التحقق من وجود الحقل
  if (!itemNameInput) {
    console.error("❌ خطأ: حقل recipeItemName غير موجود في الصفحة!");
    alert("❌ خطأ: حقل اسم الوصفة غير موجود. يرجى تحديث الصفحة والمحاولة مرة أخرى.");
    return;
  }
  
  // قراءة القيمة مباشرة - مع محاولات متعددة
  let rawValue = itemNameInput.value || "";
  
  // إذا كانت القيمة فارغة، جرب قراءتها مرة أخرى بعد تأخير بسيط
  if (!rawValue || rawValue.trim() === '') {
    console.log("⚠️ القيمة فارغة، جاري إعادة المحاولة...");
    await new Promise(resolve => setTimeout(resolve, 50));
    rawValue = itemNameInput.value || "";
  }
  
  console.log("🔍 فحص اسم الوصفة:");
  console.log("  - العنصر موجود:", true);
  console.log("  - القيمة الأصلية:", rawValue);
  console.log("  - نوع القيمة:", typeof rawValue);
  console.log("  - طول القيمة الأصلية:", rawValue ? rawValue.length : 0);
  console.log("  - الحقل visible:", itemNameInput.offsetParent !== null);
  console.log("  - الحقل disabled:", itemNameInput.disabled);
  console.log("  - الحقل readonly:", itemNameInput.readOnly);
  
  // تنظيف أفضل للقيمة (إزالة المسافات من البداية والنهاية + المسافات المتعددة)
  let itemName = "";
  if (rawValue) {
    if (typeof rawValue === 'string') {
      itemName = rawValue.trim().replace(/\s+/g, ' '); // إزالة المسافات المتعددة
    } else {
      // إذا كانت القيمة ليست string، حولها
      itemName = String(rawValue).trim().replace(/\s+/g, ' ');
    }
  }
  
  console.log("  - القيمة بعد تنظيف:", itemName);
  console.log("  - طول القيمة بعد تنظيف:", itemName.length);
  
  const reference = document.getElementById("recipeReference")?.value.trim();
  const yield = document.getElementById("recipeYield")?.value.trim();
  const portions = document.getElementById("recipePortions")?.value ? Number(document.getElementById("recipePortions").value) : null;
  const shelfLife = document.getElementById("recipeShelfLife")?.value.trim();
  const version = document.getElementById("recipeVersion")?.value.trim() || "001";
  const edition = document.getElementById("recipeEdition")?.value ? Number(document.getElementById("recipeEdition").value) : 1;
  const procedure = document.getElementById("recipeProcedure")?.value.trim();

  // التحقق من الحقول المطلوبة
  if (!itemName || itemName.length === 0) {
    console.error("❌ خطأ: اسم الوصفة فارغ");
    console.error("  - القيمة الأصلية من الحقل:", rawValue);
    console.error("  - نوع القيمة:", typeof rawValue);
    console.error("  - القيمة بعد trim:", itemName);
    
    // عرض رسالة واضحة
    const errorMsg = "⚠️ يرجى إدخال اسم الوصفة (ITEM NAME)\n\n" +
                     "تأكد من:\n" +
                     "1. كتابة اسم الوصفة في الحقل الأول\n" +
                     "2. عدم ترك الحقل فارغاً\n" +
                     "3. عدم استخدام مسافات فقط\n\n" +
                     "القيمة الحالية: '" + (rawValue || "(فارغ)") + "'";
    alert(errorMsg);
    
    itemNameInput.focus();
    itemNameInput.select();
    // إضافة border أحمر للإشارة
    itemNameInput.style.border = "2px solid #ff6b7a";
    itemNameInput.style.boxShadow = "0 0 10px rgba(255, 107, 122, 0.5)";
    setTimeout(() => {
      itemNameInput.style.border = "";
      itemNameInput.style.boxShadow = "";
    }, 3000);
    return;
  }
  
  // إزالة أي تنسيق خطأ سابق
  itemNameInput.style.border = "";
  itemNameInput.style.boxShadow = "";

  if (!yield) {
    alert("⚠️ يرجى إدخال Yield");
    document.getElementById("recipeYield")?.focus();
    return;
  }

  if (!procedure) {
    alert("⚠️ يرجى إدخال خطوات التحضير (Procedures)");
    document.getElementById("recipeProcedure")?.focus();
    return;
  }

  // جمع المكونات
  const ingredients = [];
  const tbody = document.getElementById("ingredientsTableBody");
  if (tbody) {
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row, index) => {
      const nameInput = row.querySelector(".ingredient-name");
      const quantityInput = row.querySelector(".ingredient-quantity");
      const unitSelect = row.querySelector(".ingredient-unit");
      const unitCustom = row.querySelector(".ingredient-unit-custom");
      
      if (nameInput && quantityInput) {
        const ingredientName = nameInput.value.trim();
        const quantity = quantityInput.value.trim();
        
        // الحصول على الوحدة
        let unit = "";
        if (unitSelect) {
          if (unitSelect.value === "OTHER" && unitCustom) {
            unit = unitCustom.value.trim();
          } else if (unitSelect.value) {
            unit = unitSelect.value;
          }
        }
        
        // دمج الكمية والوحدة
        let fullQuantity = quantity;
        if (unit) {
          fullQuantity = quantity + " " + unit;
        }
        
        if (ingredientName && quantity) {
          ingredients.push({
            ingredient_name: ingredientName,
            quantity: fullQuantity,
            display_order: index + 1
          });
        }
      }
    });
  }

  if (ingredients.length === 0) {
    alert("⚠️ يرجى إضافة مكون واحد على الأقل");
    return;
  }

  // تعطيل الزر أثناء المعالجة
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ جاري الحفظ...";
  }

  try {
    console.log("📤 إرسال بيانات الوصفة:", {
      item_name: itemName,
      yield,
      portions,
      shelf_life: shelfLife,
      reference,
      version,
      edition,
      procedure: procedure.substring(0, 50) + "...",
      ingredients_count: ingredients.length
    });

    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("لا يوجد توكن. يرجى تسجيل الدخول مرة أخرى");
    }

    console.log("📤 إرسال طلب إلى /api/recipes/add");
    const response = await fetch("/api/recipes/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        item_name: itemName,
        yield,
        portions,
        shelf_life: shelfLife,
        reference,
        version,
        edition,
        procedure,
        ingredients
      })
    });

    console.log("📥 حالة الاستجابة:", response.status, response.statusText);

    // التحقق من حالة الاستجابة
    if (!response.ok) {
      let errorMessage = `خطأ ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        console.error("❌ رسالة الخطأ من السيرفر:", errorMessage);
      } catch (parseErr) {
        const text = await response.text();
        console.error("❌ استجابة غير صحيحة من السيرفر:", text);
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const res = await response.json();
    console.log("📥 استجابة السيرفر (JSON):", res);

    if (res.status === "success") {
      console.log("✅ تم إضافة الوصفة بنجاح! ID:", res.data?.id);
      
      // مسح جميع الحقول لإضافة وصفة جديدة
      clearFormFields();
      
      // إعادة تفعيل الزر
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 حفظ الوصفة";
      }
      
      // إظهار رسالة نجاح
      alert("✅ تم إضافة الوصفة بنجاح!");
      
      // حفظ إشارة في localStorage لتحديث صفحة الوصفات
      localStorage.setItem('recipeAdded', 'true');
      localStorage.setItem('recipeAddedId', res.data?.id || '');
      localStorage.setItem('recipeAddedTime', Date.now().toString());
      
      // التركيز على حقل اسم الوصفة
      setTimeout(() => {
        const itemNameInput = document.getElementById("recipeItemName");
        if (itemNameInput) {
          itemNameInput.focus();
        }
      }, 100);
    } else {
      const errorMsg = res.message || "حدث خطأ أثناء إضافة الوصفة";
      console.error("❌ خطأ من السيرفر:", errorMsg);
      alert("❌ خطأ: " + errorMsg);
      // إعادة تفعيل الزر
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 حفظ الوصفة";
      }
    }
  } catch (error) {
    console.error("❌ خطأ في إضافة الوصفة:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + error.message);
    // إعادة تفعيل الزر
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 حفظ الوصفة";
    }
  }
}

