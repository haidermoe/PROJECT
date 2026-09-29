/**
 * ======================================================
 * Purchases Frontend App - معايير Odoo Purchases & P2P
 * ======================================================
 */

const token = localStorage.getItem('token');
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

let allOrders = [];
let allBills = [];
let allVendors = [];
let allIngredients = [];

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadKPIs(),
    loadOrders(),
    loadBills(),
    loadVendors(),
    loadIngredients()
  ]);
});

// ===============================
//      1) المؤشرات ولوحة الأداء
// ===============================
async function loadKPIs() {
  try {
    const res = await fetch('/api/purchase/kpis', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      const d = json.data;
      document.getElementById('kpiMonthlySpent').textContent = `${formatMoney(d.monthly_spent)} د.ع`;
      document.getElementById('kpiPendingOrders').textContent = d.pending_orders;
      document.getElementById('kpiUnpaidBills').textContent = `${formatMoney(d.unpaid_bills_amount)} د.ع`;
      document.getElementById('kpiVendorsCount').textContent = d.vendors_count;
    }
  } catch (err) {
    console.error('Error loading KPIs:', err);
  }
}

// ===============================
//      2) التبديل بين الألسنة (Tabs)
// ===============================
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  event.currentTarget.classList.add('active');
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add('active');

  if (tabName === 'orders') loadOrders();
  if (tabName === 'bills') loadBills();
  if (tabName === 'vendors') loadVendors();
}

// ===============================
//      3) أوامر الشراء (Purchase Orders)
// ===============================
async function loadOrders() {
  try {
    const res = await fetch('/api/purchase/orders', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allOrders = json.data;
      renderOrders(allOrders);
    }
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 30px;">لا توجد أوامر شراء حتى الآن. أنشئ أمر شراء جديد للبدء.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    let stateBadge = '';
    if (o.state === 'draft') stateBadge = '<span class="status-badge badge-draft">طلب تسعير (RFQ)</span>';
    else if (o.state === 'purchase') stateBadge = '<span class="status-badge badge-posted" style="background:rgba(59,130,246,0.2); color:#3b82f6;">معتمد (Confirmed)</span>';
    else if (o.state === 'done') stateBadge = '<span class="status-badge badge-posted">مكتمل ومستلم (Done)</span>';
    else if (o.state === 'cancel') stateBadge = '<span class="status-badge badge-cancel">ملغي</span>';

    let invBadge = '';
    if (o.invoice_status === 'no') invBadge = '<span style="color:#94a3b8;">غير مفوتر</span>';
    else if (o.invoice_status === 'to_invoice') invBadge = '<span style="color:#f59e0b; font-weight:bold;">بانتظار الفاتورة</span>';
    else if (o.invoice_status === 'invoiced') invBadge = '<span style="color:#10b981; font-weight:bold;">مفوتر بالكامل</span>';

    const dateStr = new Date(o.date_order).toLocaleDateString('ar-IQ');
    const plannedStr = o.date_planned ? new Date(o.date_planned).toLocaleDateString('ar-IQ') : '-';

    return `
      <tr>
        <td style="font-weight:bold; color:#a78bfa;">${o.name}</td>
        <td>
          <div style="font-weight:600;">${o.partner_name}</div>
          <small style="color:#94a3b8;">${o.partner_phone || ''}</small>
        </td>
        <td>${dateStr}</td>
        <td>${plannedStr}</td>
        <td style="text-align:center;">${o.lines_count}</td>
        <td style="font-weight:bold; color:#10b981;">${formatMoney(o.amount_total)} د.ع</td>
        <td>${stateBadge}</td>
        <td>${invBadge}</td>
        <td>
          <button class="btn-sm btn-primary" onclick="viewOrderDetails(${o.id})">
            <i class="fa-solid fa-eye"></i> فتح وتتبع
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterOrders() {
  const query = document.getElementById('orderSearchInput').value.toLowerCase();
  const filtered = allOrders.filter(o => 
    o.name.toLowerCase().includes(query) || 
    o.partner_name.toLowerCase().includes(query)
  );
  renderOrders(filtered);
}

// ===============================
//      4) تفاصيل أمر الشراء ودورة أودو (Order Details & Actions)
// ===============================
async function viewOrderDetails(orderId) {
  try {
    const res = await fetch(`/api/purchase/orders/${orderId}`, { headers });
    const json = await res.json();
    if (json.status !== 'success') return alert(json.message);

    const { order, lines, pickings, bills } = json.data;

    document.getElementById('odModalTitle').textContent = `أمر الشراء: ${order.name}`;
    document.getElementById('odPartnerName').textContent = `${order.partner_name} (${order.partner_ref || ''})`;
    document.getElementById('odPartnerPhone').textContent = order.partner_phone || 'غير مسجل';
    document.getElementById('odDateOrder').textContent = new Date(order.date_order).toLocaleString('ar-IQ');
    document.getElementById('odDatePlanned').textContent = order.date_planned || 'فوري';

    // تحديث شريط Stepper
    updateOdooStepper(order.state, order.invoice_status);

    // بناء أزرار الإجراءات
    renderOrderActionButtons(order, pickings, bills);

    // جدول البنود
    const linesTbody = document.getElementById('odLinesTableBody');
    linesTbody.innerHTML = lines.map(l => `
      <tr>
        <td style="font-weight:bold;">${l.ingredient_name}</td>
        <td>${l.product_qty} ${l.ingredient_unit}</td>
        <td style="color:${parseFloat(l.qty_received) > 0 ? '#10b981' : '#94a3b8'}; font-weight:bold;">
          ${l.qty_received} ${l.ingredient_unit}
        </td>
        <td style="color:${parseFloat(l.qty_invoiced) > 0 ? '#a78bfa' : '#94a3b8'};">
          ${l.qty_invoiced} ${l.ingredient_unit}
        </td>
        <td>${formatMoney(l.price_unit)} د.ع</td>
        <td style="font-weight:bold; color:#10b981;">${formatMoney(l.price_subtotal)} د.ع</td>
      </tr>
    `).join('');

    // إظهار أذونات الاستلام
    const pickingsSection = document.getElementById('odPickingsSection');
    const pickingsList = document.getElementById('odPickingsList');
    if (pickings && pickings.length) {
      pickingsSection.style.display = 'block';
      pickingsList.innerHTML = pickings.map(p => `
        <div style="background:#0f172a; padding:10px 15px; border-radius:6px; margin-top:5px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${p.name}</strong> 
            <span style="color:#94a3b8; font-size:0.85rem; margin-right:10px;">بتاريخ: ${new Date(p.created_at).toLocaleDateString('ar-IQ')}</span>
          </div>
          <span class="status-badge ${p.state === 'done' ? 'badge-posted' : 'badge-draft'}">
            ${p.state === 'done' ? '✅ تم استلام المخزون بالكامل' : '⏳ بانتظار فحص واستلام البضاعة'}
          </span>
        </div>
      `).join('');
    } else {
      pickingsSection.style.display = 'none';
    }

    // إظهار الفواتير المرتبطة
    const billsSection = document.getElementById('odBillsSection');
    const billsList = document.getElementById('odBillsList');
    if (bills && bills.length) {
      billsSection.style.display = 'block';
      billsList.innerHTML = bills.map(b => `
        <div style="background:#0f172a; padding:10px 15px; border-radius:6px; margin-top:5px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${b.bill_number}</strong>
            <span style="color:#10b981; font-weight:bold; margin-right:10px;">${formatMoney(b.amount_total)} د.ع</span>
          </div>
          <div>
            <span class="status-badge ${b.payment_state === 'paid' ? 'badge-posted' : 'badge-draft'}">
              ${b.payment_state === 'paid' ? 'مدفوعة' : 'غير مسددة'}
            </span>
          </div>
        </div>
      `).join('');
    } else {
      billsSection.style.display = 'none';
    }

    openModal('modalOrderDetails');
  } catch (err) {
    console.error('Error viewing order:', err);
  }
}

function updateOdooStepper(state, invoiceStatus) {
  const steps = ['step-draft', 'step-confirmed', 'step-received', 'step-billed'];
  steps.forEach(s => document.getElementById(s).className = 'step');

  if (state === 'draft') {
    document.getElementById('step-draft').classList.add('active');
  } else if (state === 'purchase') {
    document.getElementById('step-draft').classList.add('completed');
    document.getElementById('step-confirmed').classList.add('active');
  } else if (state === 'done') {
    document.getElementById('step-draft').classList.add('completed');
    document.getElementById('step-confirmed').classList.add('completed');
    document.getElementById('step-received').classList.add('completed');
    if (invoiceStatus === 'invoiced') {
      document.getElementById('step-billed').classList.add('completed');
    }
  }
}

function renderOrderActionButtons(order, pickings, bills) {
  const container = document.getElementById('odActionButtons');
  let btnsHtml = '';

  const hasPendingPicking = pickings.some(p => p.state !== 'done');
  const hasBills = bills && bills.length > 0;

  if (order.state === 'draft') {
    btnsHtml += `
      <button class="btn-success" onclick="confirmOrderAction(${order.id})">
        <i class="fa-solid fa-check"></i> 1. تأكيد أمر الشراء (Confirm Order)
      </button>
    `;
  }

  if (order.state === 'purchase' && hasPendingPicking) {
    btnsHtml += `
      <button class="btn-info" onclick="receiveOrderAction(${order.id})">
        <i class="fa-solid fa-boxes-packing"></i> 2. استلام البضاعة وتحديث المخزن (Receive Products)
      </button>
    `;
  }

  if ((order.state === 'purchase' || order.state === 'done') && !hasBills) {
    btnsHtml += `
      <button class="btn-warning" onclick="createBillAction(${order.id})">
        <i class="fa-solid fa-file-invoice"></i> 3. إنشاء فاتورة المورد وترحيل القيد (Create Bill)
      </button>
    `;
  }

  if (btnsHtml === '') {
    btnsHtml = `<span style="color:#10b981; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> اكتملت دورة هذا الطلب بالكامل وفق المعايير.</span>`;
  }

  container.innerHTML = btnsHtml;
}

async function confirmOrderAction(orderId) {
  if (!confirm('هل تريد تأكيد أمر الشراء وتوليد إذن الاستلام المخزني؟')) return;
  try {
    const res = await fetch(`/api/purchase/orders/${orderId}/confirm`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      viewOrderDetails(orderId);
      loadOrders();
      loadKPIs();
    }
  } catch (err) {
    alert('حدث خطأ في تأكيد الطلب');
  }
}

async function receiveOrderAction(orderId) {
  if (!confirm('هل تم استلام المواد وفحصها؟ سيتم زيادة رصيد المخزن وتحديث متوسط التكلفة فورياً.')) return;
  try {
    const res = await fetch(`/api/purchase/orders/${orderId}/receive`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      viewOrderDetails(orderId);
      loadOrders();
      loadKPIs();
    }
  } catch (err) {
    alert('حدث خطأ في استلام البضاعة');
  }
}

async function createBillAction(orderId) {
  if (!confirm('هل تريد إصدار فاتورة المورد وترحيل القيد المحاسبي المزدوج آلياً في دفتر اليومية؟')) return;
  try {
    const res = await fetch(`/api/purchase/orders/${orderId}/create-bill`, {
      method: 'POST',
      headers
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      viewOrderDetails(orderId);
      loadOrders();
      loadBills();
      loadKPIs();
    }
  } catch (err) {
    alert('حدث خطأ في إنشاء الفاتورة');
  }
}

// ===============================
//      5) إنشاء أمر شراء جديد (New Order Modal)
// ===============================
async function loadIngredients() {
  try {
    const res = await fetch('/api/inventory', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allIngredients = json.data;
    }
  } catch (err) {}
}

function openNewOrderModal() {
  // ملء قائمة الموردين
  const sel = document.getElementById('poVendorSelect');
  sel.innerHTML = '<option value="">-- اختر المورد --</option>' + 
    allVendors.map(v => `<option value="${v.id}">${v.name} (${v.ref || ''})</option>`).join('');

  document.getElementById('orderLinesTbody').innerHTML = '';
  addOrderLineRow();
  updateOrderGrandTotal();
  openModal('modalNewOrder');
}

function addOrderLineRow() {
  const tbody = document.getElementById('orderLinesTbody');
  const tr = document.createElement('tr');

  const optionsHtml = allIngredients.map(i => 
    `<option value="${i.id}" data-unit="${i.unit}" data-cost="${i.cost_price || 0}">${i.name} (${i.unit})</option>`
  ).join('');

  tr.innerHTML = `
    <td>
      <select class="line-ing-select" onchange="onIngredientChanged(this)">
        <option value="">-- اختر المادة --</option>
        ${optionsHtml}
      </select>
    </td>
    <td>
      <input type="number" class="line-qty" value="10" min="0.1" step="any" oninput="updateRowSubtotal(this)" />
    </td>
    <td>
      <input type="number" class="line-price" value="0" min="0" step="any" oninput="updateRowSubtotal(this)" />
    </td>
    <td>
      <span class="line-subtotal" style="font-weight:bold; color:#10b981;">0.00 د.ع</span>
    </td>
    <td>
      <button type="button" class="btn-remove-row" onclick="removeOrderLineRow(this)">&times;</button>
    </td>
  `;

  tbody.appendChild(tr);
}

function removeOrderLineRow(btn) {
  const tbody = document.getElementById('orderLinesTbody');
  if (tbody.children.length > 1) {
    btn.closest('tr').remove();
    updateOrderGrandTotal();
  } else {
    alert('يجب أن يحتوي أمر الشراء على مادة واحدة على الأقل');
  }
}

function onIngredientChanged(selectEl) {
  const selectedOpt = selectEl.selectedOptions[0];
  const cost = selectedOpt ? selectedOpt.getAttribute('data-cost') : 0;
  const row = selectEl.closest('tr');
  const priceInput = row.querySelector('.line-price');
  if (parseFloat(cost) > 0 && parseFloat(priceInput.value) === 0) {
    priceInput.value = cost;
  }
  updateRowSubtotal(priceInput);
}

function updateRowSubtotal(inputEl) {
  const row = inputEl.closest('tr');
  const qty = parseFloat(row.querySelector('.line-qty').value) || 0;
  const price = parseFloat(row.querySelector('.line-price').value) || 0;
  const subtotal = Math.round((qty * price) * 100) / 100;

  row.querySelector('.line-subtotal').textContent = `${formatMoney(subtotal)} د.ع`;
  updateOrderGrandTotal();
}

function updateOrderGrandTotal() {
  const rows = document.querySelectorAll('#orderLinesTbody tr');
  let grandTotal = 0;
  rows.forEach(r => {
    const qty = parseFloat(r.querySelector('.line-qty').value) || 0;
    const price = parseFloat(r.querySelector('.line-price').value) || 0;
    grandTotal += (qty * price);
  });
  document.getElementById('orderGrandTotal').textContent = `${formatMoney(grandTotal)} د.ع`;
}

async function submitCreateOrder() {
  const partner_id = document.getElementById('poVendorSelect').value;
  const date_planned = document.getElementById('poPlannedDate').value;
  const notes = document.getElementById('poNotes').value;

  if (!partner_id) return alert('يرجى اختيار المورد أولاً');

  const rows = document.querySelectorAll('#orderLinesTbody tr');
  const lines = [];

  for (const r of rows) {
    const ingSelect = r.querySelector('.line-ing-select');
    const ingredient_id = ingSelect.value;
    const ingName = ingSelect.selectedOptions[0]?.text || '';
    const qty = parseFloat(r.querySelector('.line-qty').value);
    const price = parseFloat(r.querySelector('.line-price').value);

    if (!ingredient_id) return alert('يرجى اختيار المادة لكل سطر');
    if (isNaN(qty) || qty <= 0) return alert('الكمية يجب أن تكون أكبر من الصفر');

    lines.push({
      ingredient_id: parseInt(ingredient_id),
      name: ingName,
      product_qty: qty,
      price_unit: price || 0
    });
  }

  try {
    const res = await fetch('/api/purchase/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify({ partner_id, date_planned, notes, lines })
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      closeModal('modalNewOrder');
      loadOrders();
      loadKPIs();
      viewOrderDetails(json.orderId);
    }
  } catch (err) {
    alert('حدث خطأ أثناء حفظ أمر الشراء');
  }
}

// ===============================
//      6) فواتير الموردين وسداد الدفعات (Bills & Payments)
// ===============================
async function loadBills() {
  try {
    const res = await fetch('/api/purchase/bills', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allBills = json.data;
      renderBills(allBills);
    }
  } catch (err) {
    console.error('Error loading bills:', err);
  }
}

function renderBills(bills) {
  const tbody = document.getElementById('billsTableBody');
  if (!bills.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 30px;">لا توجد فواتير موردين حالياً.</td></tr>`;
    return;
  }

  tbody.innerHTML = bills.map(b => {
    const remaining = parseFloat(b.amount_total) - parseFloat(b.amount_paid);
    let stateBadge = '';
    if (b.payment_state === 'paid') stateBadge = '<span class="status-badge badge-posted">مدفوعة بالكامل</span>';
    else if (b.payment_state === 'partial') stateBadge = '<span class="status-badge badge-draft" style="background:#f59e0b; color:#fff;">مسددة جزئياً</span>';
    else stateBadge = '<span class="status-badge badge-cancel">غير مسددة</span>';

    return `
      <tr>
        <td style="font-weight:bold; color:#10b981;">${b.bill_number}</td>
        <td>${b.purchase_order_name || '-'}</td>
        <td style="font-weight:600;">${b.partner_name}</td>
        <td>${new Date(b.bill_date).toLocaleDateString('ar-IQ')}</td>
        <td>${b.due_date ? new Date(b.due_date).toLocaleDateString('ar-IQ') : '-'}</td>
        <td style="font-weight:bold;">${formatMoney(b.amount_total)} د.ع</td>
        <td style="color:#10b981;">${formatMoney(b.amount_paid)} د.ع</td>
        <td style="color:#ef4444; font-weight:bold;">${formatMoney(remaining)} د.ع</td>
        <td>${stateBadge}</td>
        <td><span style="font-family:monospace; color:#a78bfa;">${b.move_name || '-'}</span></td>
        <td>
          ${b.payment_state !== 'paid' ? `
            <button class="btn-sm btn-success" onclick='openPayBillModal(${JSON.stringify(b)})'>
              <i class="fa-solid fa-credit-card"></i> سداد
            </button>
          ` : '<span style="color:#10b981; font-size:0.85rem;">مكتملة</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function filterBills() {
  const query = document.getElementById('billSearchInput').value.toLowerCase();
  const filtered = allBills.filter(b => 
    b.bill_number.toLowerCase().includes(query) || 
    b.partner_name.toLowerCase().includes(query)
  );
  renderBills(filtered);
}

function openPayBillModal(bill) {
  document.getElementById('payBillId').value = bill.id;
  document.getElementById('payBillNumber').value = bill.bill_number;
  document.getElementById('payPartnerName').value = bill.partner_name;
  document.getElementById('payTotalAmount').value = `${formatMoney(bill.amount_total)} د.ع`;

  const remaining = parseFloat(bill.amount_total) - parseFloat(bill.amount_paid);
  document.getElementById('payRemainingAmount').value = `${formatMoney(remaining)} د.ع`;
  document.getElementById('payAmountInput').value = remaining;
  document.getElementById('payAmountInput').max = remaining;

  openModal('modalPayBill');
}

async function submitPayBill() {
  const billId = document.getElementById('payBillId').value;
  const amount = parseFloat(document.getElementById('payAmountInput').value);
  const payment_method = document.getElementById('payMethodSelect').value;
  const notes = document.getElementById('payNotesInput').value;

  if (isNaN(amount) || amount <= 0) return alert('يرجى إدخال مبلغ سداد صحيح');

  try {
    const res = await fetch(`/api/purchase/bills/${billId}/pay`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount, payment_method, notes })
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      closeModal('modalPayBill');
      loadBills();
      loadKPIs();
      loadVendors();
    }
  } catch (err) {
    alert('حدث خطأ في عملية السداد');
  }
}

// ===============================
//      7) دليل الموردين (Vendors)
// ===============================
async function loadVendors() {
  try {
    const res = await fetch('/api/purchase/vendors', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allVendors = json.data;
      renderVendors(allVendors);
    }
  } catch (err) {
    console.error('Error loading vendors:', err);
  }
}

function renderVendors(vendors) {
  const grid = document.getElementById('vendorsGrid');
  if (!vendors.length) {
    grid.innerHTML = '<div style="color:#94a3b8; grid-column:1/-1; text-align:center;">لا يوجد موردين مسجلين.</div>';
    return;
  }

  grid.innerHTML = vendors.map(v => `
    <div class="vendor-card">
      <div class="vendor-header">
        <div>
          <div class="vendor-name">${v.name}</div>
          <small style="color:#94a3b8;">${v.street || 'العنوان غير محدد'}</small>
        </div>
        <span class="vendor-ref">${v.ref || 'VEND'}</span>
      </div>

      <div style="font-size:0.9rem; color:#cbd5e1;">
        <div><i class="fa-solid fa-phone" style="color:#3b82f6; width:20px;"></i> ${v.phone || 'بدون هاتف'}</div>
        <div><i class="fa-solid fa-envelope" style="color:#a78bfa; width:20px;"></i> ${v.email || 'بدون إيميل'}</div>
      </div>

      <div class="vendor-stats">
        <div class="vendor-stat-item">
          <span class="vendor-stat-label">أوامر الشراء:</span>
          <span class="vendor-stat-val">${v.total_orders} طلب</span>
        </div>
        <div class="vendor-stat-item">
          <span class="vendor-stat-label">رصيد المديونية المستحق:</span>
          <span class="vendor-stat-val" style="color:${parseFloat(v.balance) > 0 ? '#ef4444' : '#10b981'};">
            ${formatMoney(v.balance)} د.ع
          </span>
        </div>
      </div>
    </div>
  `).join('');
}

function openNewVendorModal() {
  document.getElementById('vendorNameInput').value = '';
  document.getElementById('vendorPhoneInput').value = '';
  document.getElementById('vendorEmailInput').value = '';
  document.getElementById('vendorStreetInput').value = '';
  document.getElementById('vendorTaxIdInput').value = '';
  document.getElementById('vendorNotesInput').value = '';
  openModal('modalNewVendor');
}

async function submitCreateVendor() {
  const name = document.getElementById('vendorNameInput').value;
  const phone = document.getElementById('vendorPhoneInput').value;
  const email = document.getElementById('vendorEmailInput').value;
  const street = document.getElementById('vendorStreetInput').value;
  const tax_id = document.getElementById('vendorTaxIdInput').value;
  const notes = document.getElementById('vendorNotesInput').value;

  if (!name.trim()) return alert('اسم المورد مطلوب');

  try {
    const res = await fetch('/api/purchase/vendors', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, phone, email, street, tax_id, notes })
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      closeModal('modalNewVendor');
      loadVendors();
      loadKPIs();
    }
  } catch (err) {
    alert('حدث خطأ في إضافة المورد');
  }
}

// ===============================
//      8) دوال مساعدة (Helpers)
// ===============================
function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}
