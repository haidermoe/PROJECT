/**
 * ======================================================
 * Recipe Viewer - JavaScript
 * ======================================================
 */

// الانتظار حتى يتم تحميل auth-check.js
document.addEventListener('DOMContentLoaded', async function() {
  // التأكد من أن requireAuth متاحة
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    window.location.replace("/index.html?error=login_required");
    return;
  }

  // الحصول على ID الوصفة من URL
  const urlParams = new URLSearchParams(window.location.search);
  const recipeId = urlParams.get('id');

  if (!recipeId) {
    document.body.innerHTML = `
      <div style="text-align: center; padding: 50px; font-size: 18px;">
        ❌ لم يتم تحديد الوصفة
        <br><br>
        <button onclick="window.history.back()" style="padding: 10px 20px; cursor: pointer;">
          رجوع
        </button>
      </div>
    `;
    return;
  }

  // التحقق من التوكن أولاً
  const authValid = await requireAuth();
  if (!authValid) {
    return; // تم إعادة التوجيه تلقائياً
  }

  // جلب بيانات الوصفة
  try {
    const token = localStorage.getItem("token");
    
    const response = await fetch(`/api/recipes/${recipeId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('فشل في جلب بيانات الوصفة');
    }

    const result = await response.json();

    console.log('📥 استجابة API:', result);

    if (result.status !== 'success' || !result.data) {
      throw new Error(result.message || 'الوصفة غير موجودة');
    }

    const { recipe, ingredients } = result.data;
    
    console.log('✅ تم جلب الوصفة:', recipe.item_name || recipe.name);
    console.log('✅ عدد المكونات:', ingredients ? ingredients.length : 0);

    // ملء البيانات في الصفحة
    populateRecipeData(recipe, ingredients);

  } catch (error) {
    console.error('خطأ في تحميل الوصفة:', error);
    document.body.innerHTML = `
      <div style="text-align: center; padding: 50px; font-size: 18px; color: red;">
        ❌ خطأ في تحميل الوصفة: ${error.message}
        <br><br>
        <button onclick="window.history.back()" style="padding: 10px 20px; cursor: pointer;">
          رجوع
        </button>
      </div>
    `;
  }
});

/**
 * ملء بيانات الوصفة في الصفحة
 */
function populateRecipeData(recipe, ingredients) {
  // Header Info
  document.getElementById('recipeReference').textContent = recipe.reference || '—';
  document.getElementById('recipeVersion').textContent = recipe.version || '001';
  document.getElementById('recipeEdition').textContent = recipe.edition || '1';

  // Item Details
  document.getElementById('recipeItemName').textContent = recipe.item_name || recipe.name || '—';
  document.getElementById('recipeYield').textContent = recipe.yield || '—';
  document.getElementById('recipePortions').textContent = recipe.portions || '—';
  document.getElementById('recipeShelfLife').textContent = recipe.shelf_life || '—';

  // Ingredients Table
  const ingredientsTableBody = document.getElementById('ingredientsTableBody');
  if (ingredients && ingredients.length > 0) {
    ingredientsTableBody.innerHTML = '';
    ingredients.forEach((ingredient, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${ingredient.ingredient_name || '—'}</td>
        <td>${ingredient.quantity || '—'}</td>
      `;
      ingredientsTableBody.appendChild(row);
    });
  } else {
    ingredientsTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">لا توجد مكونات</td></tr>';
  }

  // Procedures
  const proceduresContent = document.getElementById('proceduresContent');
  if (recipe.procedure) {
    proceduresContent.textContent = recipe.procedure;
  } else {
    proceduresContent.textContent = 'لا توجد خطوات تحضير محددة';
  }
}

