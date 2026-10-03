/**
 * ======================================================
 * Recipe Viewer & Order Management - JavaScript
 * ======================================================
 */

const token = localStorage.getItem("token");
if (!token) {
  alert("يجب تسجيل الدخول أولاً");
  window.location.href = "/index.html";
}

const urlParams = new URLSearchParams(window.location.search);
const recipeId = urlParams.get('id');

let currentRecipe = null;
let currentIngredients = [];
let isReorderMode = false;

document.addEventListener('DOMContentLoaded', async function() {
  if (!recipeId) {
    alert("لم يتم تحديد كود الوصفة");
    window.location.href = "/recipes.html";
    return;
  }

  await loadRecipeData();
});

async function loadRecipeData() {
  try {
    const response = await fetch(`/api/recipes/${recipeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('فشل جلب بيانات الوصفة');

    const result = await response.json();
    if (result.status !== 'success' || !result.data) {
      throw new Error(result.message || 'الوصفة غير موجودة');
    }

    currentRecipe = result.data.recipe;
    currentIngredients = result.data.ingredients || [];

    renderRecipeView();
  } catch (err) {
    console.error('خطأ في جلب بيانات الوصفة:', err);
    alert(`❌ خطأ: ${err.message}`);
  }
}

function renderRecipeView() {
  if (!currentRecipe) return;

  // Header & Title
  const titleText = currentRecipe.item_name || currentRecipe.name || '—';
  document.title = `Standard Recipe: ${titleText}`;
  const toolbarTitle = document.getElementById('toolbarRecipeTitle');
  if (toolbarTitle) toolbarTitle.textContent = `📋 كرت الوصفة: ${titleText}`;

  document.getElementById('recipeReference').textContent = currentRecipe.reference || '—';
  document.getElementById('recipeVersion').textContent = currentRecipe.version || '001';
  document.getElementById('recipeEdition').textContent = currentRecipe.edition || '1';

  // Details
  document.getElementById('recipeItemName').textContent = titleText;
  document.getElementById('recipeYield').textContent = currentRecipe.yield || '—';
  document.getElementById('recipePortions').textContent = currentRecipe.portions || '1';
  document.getElementById('recipeShelfLife').textContent = currentRecipe.shelf_life || '—';

  // Render Ingredients Table
  renderIngredientsTable();

  // Procedures
  const proceduresContent = document.getElementById('proceduresContent');
  if (proceduresContent) {
    proceduresContent.textContent = currentRecipe.procedure || 'لا توجد خطوات تحضير معيارية محددة.';
  }
}

function renderIngredientsTable() {
  const tbody = document.getElementById('ingredientsTableBody');
  if (!tbody) return;

  if (currentIngredients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">لا توجد مكونات مسجلة لهذه الوصفة بعد. اضغط على "تعديل محتويات الوصفة" لإضافتها.</td></tr>';
    return;
  }

  tbody.innerHTML = currentIngredients.map((ing, idx) => {
    const qtyText = ing.quantity ? `${ing.quantity} ${ing.unit || ''}`.trim() : '—';
    return `
      <tr>
        <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
        <td style="font-weight:600;">${ing.ingredient_name || ing.name}</td>
        <td style="font-weight:600; direction:ltr; text-align:right;">${qtyText}</td>
        <td class="order-col no-print" style="text-align:center;">
          <div class="order-btn-group">
            <button type="button" class="btn-order-move" onclick="moveIngredient(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} title="تحريك لأعلى">▲</button>
            <button type="button" class="btn-order-move" onclick="moveIngredient(${idx}, 1)" ${idx === currentIngredients.length - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} title="تحريك لأسفل">▼</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// تبديل المكونات وتغيير ترتيبها
window.moveIngredient = function(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= currentIngredients.length) return;

  const temp = currentIngredients[index];
  currentIngredients[index] = currentIngredients[newIndex];
  currentIngredients[newIndex] = temp;

  renderIngredientsTable();

  // إظهار زر حفظ الترتيب
  const saveBtn = document.getElementById('saveOrderBtn');
  if (saveBtn) saveBtn.style.display = 'inline-flex';
  const hint = document.getElementById('reorderHint');
  if (hint) hint.style.display = 'inline-block';
};

window.toggleReorderMode = function() {
  isReorderMode = !isReorderMode;
  const hint = document.getElementById('reorderHint');
  const saveBtn = document.getElementById('saveOrderBtn');

  if (isReorderMode) {
    if (hint) hint.style.display = 'inline-block';
    if (saveBtn) saveBtn.style.display = 'inline-flex';
  } else {
    if (hint) hint.style.display = 'none';
  }
};

window.saveNewIngredientsOrder = async function() {
  if (!currentRecipe || currentIngredients.length === 0) return;

  const saveBtn = document.getElementById('saveOrderBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ جاري الحفظ...';
  }

  try {
    const res = await fetch(`/api/recipes/edit/${recipeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        item_name: currentRecipe.item_name || currentRecipe.name,
        name: currentRecipe.name || currentRecipe.item_name,
        yield: currentRecipe.yield,
        portions: currentRecipe.portions,
        shelf_life: currentRecipe.shelf_life,
        reference: currentRecipe.reference,
        version: currentRecipe.version,
        edition: currentRecipe.edition,
        procedure: currentRecipe.procedure,
        ingredients: currentIngredients.map((ing, idx) => ({
          ingredient_name: ing.ingredient_name || ing.name,
          quantity: ing.quantity,
          unit: ing.unit || '',
          display_order: idx + 1
        }))
      })
    });

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم حفظ ترتيب أسبقية المكونات بنجاح!');
    if (saveBtn) {
      saveBtn.style.display = 'none';
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ الترتيب الجديد';
    }
    const hint = document.getElementById('reorderHint');
    if (hint) hint.style.display = 'none';

    await loadRecipeData();
  } catch (err) {
    alert(`❌ خطأ في حفظ الترتيب: ${err.message}`);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ الترتيب الجديد';
    }
  }
};

window.goToEditPage = function() {
  window.location.href = `/add-recipe.html?id=${recipeId}&edit=true`;
};
