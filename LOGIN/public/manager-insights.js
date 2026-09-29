document.addEventListener('DOMContentLoaded', async () => {
  if (typeof requireAuth !== 'undefined') {
    const authValid = await requireAuth();
    if (!authValid) return;
  }

  // Highlight current page in sidebar
  setTimeout(() => {
    const links = document.querySelectorAll('.sidebar .menu-item');
    links.forEach(link => {
      if (link.href && link.href.includes('manager-insights.html')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }, 100);

  // Load Data
  fetchWasteMetrics();
  fetchFraudAlerts();
  fetchLowStock();
  fetchEmployeeRanking();
  fetchZReports();

  // Bind Generate Z-Report Button
  const zReportBtn = document.getElementById('generate-z-report');
  if (zReportBtn) {
    zReportBtn.addEventListener('click', generateZReport);
  }
});

// Helper for API calls
async function apiCall(endpoint, method = 'GET') {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const response = await fetch(`/api/manager${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const err = await response.json();
      console.error('API Error:', err);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Network Error:', error);
    return null;
  }
}

// 1. Waste Metrics
async function fetchWasteMetrics() {
  const res = await apiCall('/waste-metrics');
  if (res && res.status === 'success') {
    const { total_waste, waste_percentage } = res.data;
    document.getElementById('waste-total').textContent = parseFloat(total_waste || 0).toFixed(2);
    
    const progress = document.getElementById('waste-progress');
    const pct = Math.min(parseFloat(waste_percentage || 0), 100);
    progress.style.width = `${pct}%`;
    
    // Color coding based on threshold
    if (pct > 75) {
      progress.style.background = 'var(--danger)';
    } else if (pct > 50) {
      progress.style.background = 'var(--warning)';
    } else {
      progress.style.background = 'var(--secondary)';
    }
    
    document.getElementById('waste-percentage').textContent = `${pct.toFixed(1)}% of daily threshold`;
  }
}

// 2. Fraud Alerts
async function fetchFraudAlerts() {
  const res = await apiCall('/fraud-alerts');
  const list = document.getElementById('fraud-alerts-list');
  list.innerHTML = '';

  if (res && res.status === 'success' && res.data.length > 0) {
    res.data.forEach(alert => {
      const date = new Date(alert.created_at).toLocaleString('ar-EG');
      const li = document.createElement('li');
      li.className = 'alert-item';
      li.innerHTML = `
        <div class="alert-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="alert-content">
          <h4 class="alert-title">${alert.action_type === 'delete' ? 'Delete Action' : 'Manual Adjustment'} - ${alert.entity_type}</h4>
          <p class="alert-desc">${alert.details}</p>
          <div class="alert-meta">
            <span><i class="fa-regular fa-user"></i> ${alert.user_name}</span>
            <span><i class="fa-regular fa-clock"></i> ${date}</span>
          </div>
        </div>
      `;
      list.appendChild(li);
    });
  } else {
    list.innerHTML = '<li class="alert-item"><div class="alert-content"><p class="alert-desc">No recent alerts.</p></div></li>';
  }
}

// 3. Inventory Watchdog (Low Stock)
async function fetchLowStock() {
  const res = await apiCall('/low-stock');
  const tbody = document.getElementById('low-stock-table');
  tbody.innerHTML = '';

  if (res && res.status === 'success' && res.data.length > 0) {
    res.data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td>${parseFloat(item.stock_quantity).toFixed(2)}</td>
        <td>${item.unit}</td>
        <td><span class="status-badge status-danger">Low Stock</span></td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">All stock levels are good.</td></tr>';
  }
}

// 4. Committed Employee Ranking
async function fetchEmployeeRanking() {
  const res = await apiCall('/ranking');
  const list = document.getElementById('employee-ranking-list');
  list.innerHTML = '';

  if (res && res.status === 'success' && res.data.length > 0) {
    res.data.forEach((emp, index) => {
      const rankClass = index < 3 ? `rank-${index + 1}` : '';
      const icon = index === 0 ? '<i class="fa-solid fa-trophy"></i>' : (index + 1);
      
      const div = document.createElement('div');
      div.className = 'leaderboard-item';
      div.innerHTML = `
        <div class="leaderboard-rank ${rankClass}">${icon}</div>
        <div class="leaderboard-avatar">${emp.name.charAt(0).toUpperCase()}</div>
        <div class="leaderboard-info">
          <h4 class="leaderboard-name">${emp.name}</h4>
          <p class="leaderboard-score">Score: ${emp.score} | Waste Errors: ${emp.waste_count}</p>
        </div>
      `;
      list.appendChild(div);
    });
  } else {
    list.innerHTML = '<div class="leaderboard-item"><p>No data available yet.</p></div>';
  }
}

// 5. Z-Reports
async function fetchZReports() {
  const res = await apiCall('/z-report');
  const tbody = document.getElementById('z-reports-table');
  tbody.innerHTML = '';

  if (res && res.status === 'success' && res.data.length > 0) {
    res.data.forEach(report => {
      const date = new Date(report.report_date).toLocaleDateString('ar-EG');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${date}</strong></td>
        <td>System / Manager</td>
        <td>${parseFloat(report.theoretical_stock).toFixed(2)}</td>
        <td>${parseFloat(report.actual_stock).toFixed(2)}</td>
        <td><span class="${report.variance < 0 ? 'status-danger' : 'status-success'} status-badge">${parseFloat(report.variance).toFixed(2)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No Z-Reports generated yet.</td></tr>';
  }
}

// Generate Z-Report Action
async function generateZReport() {
  const btn = document.getElementById('generate-z-report');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

  const res = await apiCall('/z-report', 'POST');
  if (res && res.status === 'success') {
    alert('Z-Report Generated Successfully');
    fetchZReports(); // Refresh list
  } else {
    alert('Failed to generate Z-Report');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-file-invoice"></i> Generate Z-Report';
}
