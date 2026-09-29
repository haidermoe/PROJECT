/* ======================================================
   Recipes Management – Full Logic (Westig System)
====================================================== */

// ---------------------------------------------
// 1) حماية الصفحة - التحقق من التوكن
// ---------------------------------------------
// الانتظار حتى يتم تحميل auth-check.js
document.addEventListener('DOMContentLoaded', async function() {
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
  initializeRecipes();
  
  // التحقق من إضافة وصفة جديدة وتحديث القائمة
  checkForNewRecipe();
  
  // مراقبة localStorage لتحديث القائمة عند إضافة وصفة جديدة
  window.addEventListener('storage', (e) => {
    if (e.key === 'recipeAdded' && e.newValue === 'true') {
      console.log('🔄 تم إضافة وصفة جديدة، جاري تحديث القائمة...');
      loadRecipesPage();
      localStorage.removeItem('recipeAdded');
      localStorage.removeItem('recipeAddedId');
      localStorage.removeItem('recipeAddedTime');
    }
  });
  
  // التحقق كل ثانية من localStorage (لنفس النافذة)
  setInterval(() => {
    checkForNewRecipe();
  }, 1000);
});

// التحقق من إضافة وصفة جديدة
function checkForNewRecipe() {
  const recipeAdded = localStorage.getItem('recipeAdded');
  if (recipeAdded === 'true') {
    const addedTime = parseInt(localStorage.getItem('recipeAddedTime') || '0');
    const now = Date.now();
    // تحديث فقط إذا كانت الإضافة حديثة (خلال آخر 5 ثواني)
    if (now - addedTime < 5000) {
      console.log('🔄 تم إضافة وصفة جديدة، جاري تحديث القائمة...');
      loadRecipesPage();
      localStorage.removeItem('recipeAdded');
      localStorage.removeItem('recipeAddedId');
      localStorage.removeItem('recipeAddedTime');
    }
  }
}

// تهيئة صفحة الوصفات
function initializeRecipes() {
  // تطبيق الصلاحيات
  applyRecipePermissions();
  
  // إعداد event listeners
  setupRecipeListeners();
  
  // تحميل البيانات
  loadRecipesPage();
}

// تطبيق الصلاحيات على صفحة الوصفات
function applyRecipePermissions() {
  const user = getCurrentUser();
  if (!user) return;

  // الموظف: إخفاء زر إضافة وصفة
  if (user.role === 'employee') {
    const addBtn = document.getElementById('addRecipeBtn');
    if (addBtn) addBtn.style.display = 'none';
  }
}

// دالة مساعدة لجلب المستخدم الحالي
function getCurrentUser() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// إعداد event listeners
function setupRecipeListeners() {
  // ملاحظة: زر إضافة وصفة الآن يوجه لصفحة منفصلة
  // لا حاجة لفتح modal بعد الآن

  // زر إضافة مكون
  const addIngredientBtn = document.getElementById("addIngredientBtn");
  if (addIngredientBtn) {
    addIngredientBtn.addEventListener("click", () => {
      addIngredientRow();
    });
  }

  // زر إلغاء
  const cancelAdd = document.getElementById("cancelAdd");
  if (cancelAdd) {
    cancelAdd.addEventListener("click", () => {
      const modal = document.getElementById("addModal");
      if (modal) {
        modal.classList.remove("active");
        clearModalFields();
      }
    });
  }

  // زر حفظ
  const saveAdd = document.getElementById("saveAdd");
  if (saveAdd) {
    saveAdd.addEventListener("click", async () => {
      await handleAddRecipe();
    });
  }

  // زر إلغاء الإنتاج
  const cancelProduction = document.getElementById("cancelProduction");
  if (cancelProduction) {
    cancelProduction.addEventListener("click", () => {
      const modal = document.getElementById("productionModal");
      if (modal) {
        modal.classList.remove("active");
        // مسح الحقول
        const qtyInput = document.getElementById("productionQuantity");
        const weightInput = document.getElementById("portionWeight");
        const dateInput = document.getElementById("productionDate");
        if (qtyInput) qtyInput.value = "";
        if (weightInput) weightInput.value = "";
        if (dateInput) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          dateInput.value = now.toISOString().slice(0, 16);
        }
      }
    });
  }

  // إغلاق المودال عند النقر خارجها
  const modal = document.getElementById("addModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        clearModalFields();
      }
    });
  }

  // إغلاق modal الإنتاج عند النقر خارجها
  const productionModal = document.getElementById("productionModal");
  if (productionModal) {
    productionModal.addEventListener("click", (e) => {
      if (e.target === productionModal) {
        productionModal.classList.remove("active");
      }
    });
  }

  // تعيين تاريخ اليوم كافتراضي في حقل تاريخ الإنتاج
  const productionDateInput = document.getElementById("productionDate");
  if (productionDateInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    productionDateInput.value = now.toISOString().slice(0, 16);
  }
}

// إضافة صف مكون جديد
function addIngredientRow() {
  const tbody = document.getElementById("ingredientsTableBody");
  if (!tbody) return;

  const rowCount = tbody.children.length;
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${rowCount + 1}</td>
    <td>
      <input type="text" class="ingredient-name" placeholder="اسم المكون" />
    </td>
    <td>
      <input type="text" class="ingredient-quantity" placeholder="مثال: 200 ML" />
    </td>
    <td>
      <button type="button" class="btn-delete" onclick="removeIngredientRow(this)">🗑</button>
    </td>
  `;
  tbody.appendChild(row);
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

// مسح حقول المودال
function clearModalFields() {
  // مسح الحقول الأساسية
  const recipeItemName = document.getElementById("recipeItemName");
  const recipeReference = document.getElementById("recipeReference");
  const recipeYield = document.getElementById("recipeYield");
  const recipePortions = document.getElementById("recipePortions");
  const recipeShelfLife = document.getElementById("recipeShelfLife");
  const recipeVersion = document.getElementById("recipeVersion");
  const recipeEdition = document.getElementById("recipeEdition");
  const recipeProcedure = document.getElementById("recipeProcedure");
  
  if (recipeItemName) recipeItemName.value = "";
  if (recipeReference) recipeReference.value = "";
  if (recipeYield) recipeYield.value = "";
  if (recipePortions) recipePortions.value = "";
  if (recipeShelfLife) recipeShelfLife.value = "";
  if (recipeVersion) recipeVersion.value = "001";
  if (recipeEdition) recipeEdition.value = "1";
  if (recipeProcedure) recipeProcedure.value = "";
  
  // مسح جدول المكونات
  const tbody = document.getElementById("ingredientsTableBody");
  if (tbody) {
    tbody.innerHTML = "";
  }
}

// معالجة إضافة وصفة (Standard Recipe Template)
async function handleAddRecipe() {
  // قراءة القيم مع تسجيل للتشخيص
  const itemNameInput = document.getElementById("recipeItemName");
  
  // تنظيف أفضل للقيمة (إزالة المسافات من البداية والنهاية + المسافات المتعددة)
  let itemName = "";
  if (itemNameInput) {
    const rawValue = itemNameInput.value || "";
    itemName = rawValue.trim().replace(/\s+/g, ' '); // إزالة المسافات المتعددة
  }
  
  console.log("🔍 فحص اسم الوصفة:");
  console.log("  - العنصر موجود:", !!itemNameInput);
  if (itemNameInput) {
    console.log("  - القيمة الأصلية:", itemNameInput.value);
    console.log("  - نوع القيمة:", typeof itemNameInput.value);
    console.log("  - طول القيمة الأصلية:", itemNameInput.value.length);
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
    console.error("  - القيمة الأصلية من الحقل:", itemNameInput ? itemNameInput.value : "الحقل غير موجود");
    console.error("  - نوع القيمة:", typeof (itemNameInput ? itemNameInput.value : "N/A"));
    
    // عرض رسالة واضحة
    const errorMsg = "⚠️ يرجى إدخال اسم الوصفة (ITEM NAME)\n\n" +
                     "تأكد من:\n" +
                     "1. كتابة اسم الوصفة في الحقل الأول\n" +
                     "2. عدم ترك الحقل فارغاً\n" +
                     "3. عدم استخدام مسافات فقط";
    alert(errorMsg);
    
    if (itemNameInput) {
      itemNameInput.focus();
      itemNameInput.select();
      // إضافة border أحمر للإشارة
      itemNameInput.style.border = "2px solid #ff6b7a";
      setTimeout(() => {
        itemNameInput.style.border = "";
      }, 3000);
    }
    return;
  }
  
  // إزالة أي تنسيق خطأ سابق
  if (itemNameInput) {
    itemNameInput.style.border = "";
  }

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
      
      if (nameInput && quantityInput) {
        const ingredientName = nameInput.value.trim();
        const quantity = quantityInput.value.trim();
        
        if (ingredientName && quantity) {
          ingredients.push({
            ingredient_name: ingredientName,
            quantity: quantity,
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
  const saveBtn = document.getElementById("saveAdd");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "جاري الحفظ...";
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

    const res = await API("POST", "/api/recipes/add", {
      item_name: itemName,
      yield,
      portions,
      shelf_life: shelfLife,
      reference,
      version,
      edition,
      procedure,
      ingredients
    });

    console.log("📥 استجابة السيرفر:", res);

    if (res.status === "success") {
      const modal = document.getElementById("addModal");
      if (modal) {
        modal.classList.remove("active");
      }
      clearModalFields();
      loadRecipesPage();
      alert("✅ تم إضافة الوصفة بنجاح!");
      
      // إعادة توجيه لعرض الوصفة إذا كان هناك ID
      if (res.data && res.data.id) {
        // تأخير بسيط لإظهار رسالة النجاح
        setTimeout(() => {
          window.location.href = `/recipe-viewer.html?id=${res.data.id}`;
        }, 500);
      }
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ أثناء إضافة الوصفة"));
    }
  } catch (error) {
    console.error("❌ خطأ في إضافة الوصفة:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + error.message);
  } finally {
    // إعادة تفعيل الزر
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "حفظ الوصفة";
    }
  }
}

// ---------------------------------------------
// 2) API Helper
// ---------------------------------------------
async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };
  if (body) config.body = JSON.stringify(body);

  try {
    const res = await fetch(endpoint, config);
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ API Error:', res.status, errorText);
      return { status: "error", message: `خطأ ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('❌ API Fetch Error:', error);
    return { status: "error", message: error.message };
  }
}

// ---------------------------------------------
// 3) تحميل البيانات الأساسية
// ---------------------------------------------
async function loadRecipesPage() {
  loadKPIs();
  loadTable();
  loadPopularRecipes();
  loadRecentRecipes();
}

// ---------------------------------------------
// 4) KPIs
// ---------------------------------------------
async function loadKPIs() {
  try {
    const res = await API("GET", "/api/recipes/kpi");
    
    if (res.status === "success") {
      document.getElementById("kpiTotalRecipes").textContent = res.data.total_recipes || 0;
      document.getElementById("kpiActiveRecipes").textContent = res.data.active_recipes || 0;
      document.getElementById("kpiTodayRecipes").textContent = res.data.today_recipes || 0;
      document.getElementById("kpiAvgCost").textContent = res.data.avg_cost ? `${res.data.avg_cost} د` : "0 د";
    }
  } catch (error) {
    console.error("خطأ في تحميل KPIs:", error);
    document.getElementById("kpiTotalRecipes").textContent = "0";
    document.getElementById("kpiActiveRecipes").textContent = "0";
    document.getElementById("kpiTodayRecipes").textContent = "0";
    document.getElementById("kpiAvgCost").textContent = "0 د";
  }
}

// ---------------------------------------------
// 5) جدول الوصفات
// ---------------------------------------------
async function loadTable() {
  try {
    const res = await API("GET", "/api/recipes");

    const tbody = document.querySelector("#recipesTable tbody");
    tbody.innerHTML = "";

    const user = getCurrentUser();
    const isEmployee = user && user.role === 'employee';
    const isKitchenManager = user && user.role === 'kitchen_manager';
    const isAdmin = user && user.role === 'admin';

    if (res.status === "success" && res.data.length > 0) {
      res.data.forEach(recipe => {
        const row = document.createElement("tr");

        const status = recipe.status === 'active' ? "نشط" : recipe.status === 'pending_approval' ? "في انتظار الموافقة" : "مسودة";
        const statusColor = status === "نشط" 
          ? `<span style="color:#00ff88">✔ ${status}</span>`
          : status === "في انتظار الموافقة"
          ? `<span style="color:#ffc107">⏳ ${status}</span>`
          : `<span style="color:#9ba3b5">📝 ${status}</span>`;
        const category = "عام"; // يمكن إضافة category لاحقاً
        const cost = "0"; // يمكن إضافة cost لاحقاً
        const time = "—"; // يمكن إضافة time لاحقاً

        // جميع المستخدمين يمكنهم عرض الوصفة
        const viewButton = `<button class="btn-mini view" onclick="viewRecipe(${recipe.id})" title="عرض الوصفة">👁️</button>`;
        
        // زر إنتاج الوصفة (للمدير والشيف)
        const produceButton = (!isEmployee) 
          ? ` <button class="btn-mini produce" onclick="openProductionModal(${recipe.id})" title="إنتاج الوصفة">🏭</button>`
          : '';
        
        // الموظف: فقط عرض
        // الشيف: عرض + إنتاج + تعديل (يحتاج موافقة)
        // المدير: كل الأزرار
        let actionButtons = viewButton + produceButton;
        if (!isEmployee) {
          if (isKitchenManager) {
            // الشيف: عرض + إنتاج + تعديل (يحتاج موافقة)
            actionButtons += ` <button class="btn-mini edit" onclick="openEdit(${recipe.id})" title="تعديل (يحتاج موافقة)">✏</button>`;
          } else if (isAdmin) {
            // المدير: كل الأزرار
            actionButtons += ` 
              <button class="btn-mini edit" onclick="openEdit(${recipe.id})" title="تعديل">✏</button>
              <button class="btn-mini delete" onclick="deleteRecipe(${recipe.id})" title="حذف">🗑</button>
            `;
          }
        }

        const recipeName = recipe.item_name || recipe.name || '—';
        const recipeYield = recipe.yield || '—';
        const recipePortions = recipe.portions || '—';
        const recipeVersion = recipe.version || '001';
        
        const date = recipe.created_at ? new Date(recipe.created_at) : null;
        const dateStr = date ? date.toLocaleDateString('ar-EG') : '—';

        row.innerHTML = `
          <td>${recipeName}</td>
          <td>${recipeYield}</td>
          <td>${recipePortions}</td>
          <td>${recipeVersion}</td>
          <td>${dateStr}</td>
          <td style="text-align:center;">
            ${actionButtons}
          </td>
        `;

        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>لا توجد وصفات</td></tr>";
    }
  } catch (error) {
    console.error("خطأ في تحميل الوصفات:", error);
    const tbody = document.querySelector("#recipesTable tbody");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>حدث خطأ في تحميل البيانات</td></tr>";
    }
  }
}

// عرض الوصفة
function viewRecipe(id) {
  window.location.href = `/recipe-viewer.html?id=${id}`;
}

// فتح modal لإنتاج الوصفة
function openProductionModal(recipeId) {
  console.log('🔵 فتح modal الإنتاج للوصفة:', recipeId);
  
  // جلب بيانات الوصفة أولاً
  loadRecipeForProduction(recipeId);
}

// جلب بيانات الوصفة للإنتاج
async function loadRecipeForProduction(recipeId) {
  try {
    console.log('🔵 جاري جلب بيانات الوصفة:', recipeId);
    const res = await API("GET", `/api/recipes/${recipeId}`);
    
    console.log('📥 استجابة API:', res);
    
    if (res.status === "success" && res.data) {
      // API يرجع البيانات في res.data.recipe
      const recipe = res.data.recipe || res.data;
      console.log('📊 بيانات الوصفة:', recipe);
      console.log('📊 item_name:', recipe.item_name);
      console.log('📊 name:', recipe.name);
      console.log('📊 yield:', recipe.yield);
      console.log('📊 shelf_life:', recipe.shelf_life);
      
      // تعبئة بيانات الوصفة في modal
      const recipeIdInput = document.getElementById("productionRecipeId");
      if (recipeIdInput) {
        recipeIdInput.value = recipeId;
      }
      
      const nameEl = document.getElementById("productionRecipeName");
      const yieldEl = document.getElementById("productionRecipeYield");
      const shelfLifeEl = document.getElementById("productionRecipeShelfLife");
      
      if (nameEl) {
        const recipeName = recipe.item_name || recipe.name || '—';
        console.log('✅ تعبئة اسم الوصفة:', recipeName);
        nameEl.textContent = recipeName;
        nameEl.style.color = '#ffffff';
        nameEl.style.display = 'block';
      } else {
        console.error('❌ لم يتم العثور على productionRecipeName');
      }
      
      if (yieldEl) {
        const recipeYield = recipe.yield || '—';
        console.log('✅ تعبئة Yield:', recipeYield);
        yieldEl.textContent = recipeYield;
        yieldEl.style.color = '#ffffff';
        yieldEl.style.display = 'block';
      } else {
        console.error('❌ لم يتم العثور على productionRecipeYield');
      }
      
      if (shelfLifeEl) {
        const recipeShelfLife = recipe.shelf_life || '—';
        console.log('✅ تعبئة مدة الصلاحية:', recipeShelfLife);
        shelfLifeEl.textContent = recipeShelfLife;
        shelfLifeEl.style.color = '#ffffff';
        shelfLifeEl.style.display = 'block';
      } else {
        console.error('❌ لم يتم العثور على productionRecipeShelfLife');
      }
      
      // فتح modal
      const modal = document.getElementById("productionModal");
      if (modal) {
        modal.classList.add("active");
        console.log('✅ تم فتح modal الإنتاج');
        
        // التركيز على حقل الكمية
        setTimeout(() => {
          const qtyInput = document.getElementById("productionQuantity");
          if (qtyInput) {
            qtyInput.focus();
          }
        }, 100);
      } else {
        console.error('❌ لم يتم العثور على productionModal');
      }
    } else {
      console.error('❌ فشل تحميل بيانات الوصفة:', res);
      alert("❌ فشل تحميل بيانات الوصفة: " + (res.message || 'خطأ غير معروف'));
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الوصفة:", error);
    console.error("❌ Stack:", error.stack);
    alert("❌ حدث خطأ في تحميل بيانات الوصفة: " + error.message);
  }
}

// إنتاج الوصفة
async function handleProduceRecipe() {
  try {
    const recipeId = document.getElementById("productionRecipeId").value;
    const productionQuantity = document.getElementById("productionQuantity").value.trim();
    const portionWeight = document.getElementById("portionWeight").value.trim();
    const productionDate = document.getElementById("productionDate").value;

    // التحقق من الحقول المطلوبة
    if (!productionQuantity || !portionWeight || !productionDate) {
      alert("⚠️ يرجى إدخال جميع الحقول المطلوبة");
      return;
    }

    // تعطيل الزر أثناء المعالجة
    const produceBtn = document.getElementById("produceBtn");
    if (produceBtn) {
      produceBtn.disabled = true;
      produceBtn.textContent = "⏳ جاري الإنتاج...";
    }

    console.log("📤 إرسال طلب إنتاج:", {
      recipeId,
      productionQuantity,
      portionWeight,
      productionDate
    });

    const res = await API("POST", `/api/recipes/${recipeId}/produce`, {
      production_quantity: parseFloat(productionQuantity),
      portion_weight: parseFloat(portionWeight),
      production_date: productionDate
    });

    console.log("📥 استجابة السيرفر:", res);

    if (res.status === "success" && res.data) {
      // إغلاق modal
      const modal = document.getElementById("productionModal");
      if (modal) {
        modal.classList.remove("active");
      }

      // مسح الحقول
      document.getElementById("productionQuantity").value = "";
      document.getElementById("portionWeight").value = "";
      document.getElementById("productionDate").value = "";

      // التوجيه إلى صفحة الإنتاج
      if (res.data.production_id) {
        alert("✅ تم إنشاء الإنتاج بنجاح!");
        setTimeout(() => {
          window.location.href = `/recipe-production.html?id=${res.data.production_id}`;
        }, 500);
      }
    } else {
      const errorMsg = res.message || "حدث خطأ أثناء إنشاء الإنتاج";
      console.error("❌ خطأ من السيرفر:", errorMsg);
      alert("❌ خطأ: " + errorMsg);
      
      if (produceBtn) {
        produceBtn.disabled = false;
        produceBtn.textContent = "✅ إنتاج الوصفة";
      }
    }
  } catch (error) {
    console.error("❌ خطأ في إنتاج الوصفة:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + error.message);
    
    const produceBtn = document.getElementById("produceBtn");
    if (produceBtn) {
      produceBtn.disabled = false;
      produceBtn.textContent = "✅ إنتاج الوصفة";
    }
  }
}

// ---------------------------------------------
// 6) الوصفات الشائعة
// ---------------------------------------------
async function loadPopularRecipes() {
  try {
    const res = await API("GET", "/api/recipes/popular");
    const list = document.getElementById("popularRecipes");
    list.innerHTML = "";

    if (res.status === "success" && res.data.length > 0) {
      res.data.forEach(recipe => {
        const li = document.createElement("li");
        li.textContent = `⭐ ${recipe.name}`;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = "<li>لا توجد وصفات</li>";
    }
  } catch (error) {
    console.error("خطأ في تحميل الوصفات الشائعة:", error);
  }
}

// ---------------------------------------------
// 7) آخر الإضافات
// ---------------------------------------------
async function loadRecentRecipes() {
  try {
    const res = await API("GET", "/api/recipes/recent");
    const list = document.getElementById("recentRecipes");
    list.innerHTML = "";

    if (res.status === "success" && res.data.length > 0) {
      res.data.forEach(recipe => {
        const li = document.createElement("li");
        const date = new Date(recipe.created_at);
        const dateStr = date.toLocaleDateString('ar-EG');
        li.textContent = `📝 ${recipe.name} - ${dateStr}`;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = "<li>لا توجد إضافات حديثة</li>";
    }
  } catch (error) {
    console.error("خطأ في تحميل آخر الإضافات:", error);
  }
}

// ======================================================
// 8) إضافة وصفة - تم نقلها إلى setupRecipeListeners()
// ======================================================

// ======================================================
// 9) تعديل وحذف
// ======================================================
async function openEdit(id) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const res = await API("GET", `/api/recipes/${id}`);
    
    if (res.status === "success" && res.data) {
      const recipe = res.data;
      
      // إذا كان شيف، نحتاج موافقة
      if (user.role === 'kitchen_manager') {
        const name = prompt("اسم الوصفة الجديد:", recipe.name);
        if (!name) return;
        
        const description = prompt("الوصف الجديد:", recipe.description || '');
        const visibleToEmployees = confirm("هل تريد جعلها مرئية للموظفين؟");
        
        const editRes = await API("PUT", `/api/recipes/edit/${id}`, {
          name,
          description,
          visible_to_employees: visibleToEmployees
        });
        
        if (editRes.status === "success") {
          alert(editRes.message || "تم إرسال طلب الموافقة بنجاح");
          loadRecipesPage();
        } else {
          alert(editRes.message || "حدث خطأ");
        }
      } else if (user.role === 'admin') {
        // المدير: تعديل مباشر
        const name = prompt("اسم الوصفة:", recipe.name);
        if (!name) return;
        
        const description = prompt("الوصف:", recipe.description || '');
        const visibleToEmployees = confirm("هل تريد جعلها مرئية للموظفين؟");
        
        const editRes = await API("PUT", `/api/recipes/edit/${id}`, {
          name,
          description,
          visible_to_employees: visibleToEmployees
        });
        
        if (editRes.status === "success") {
          alert("تم التعديل بنجاح");
          loadRecipesPage();
        } else {
          alert(editRes.message || "حدث خطأ");
        }
      }
    }
  } catch (error) {
    console.error("خطأ في فتح التعديل:", error);
    alert("حدث خطأ في تحميل بيانات الوصفة");
  }
}

async function deleteRecipe(id) {
  if (confirm("هل أنت متأكد من حذف هذه الوصفة؟")) {
    try {
      const res = await API("DELETE", `/api/recipes/delete/${id}`);
      if (res.status === "success") {
        loadRecipesPage();
      } else {
        alert(res.message || "حدث خطأ أثناء حذف الوصفة");
      }
    } catch (error) {
      console.error("خطأ في حذف الوصفة:", error);
      alert("حدث خطأ في الاتصال بالسيرفر");
    }
  }
}

