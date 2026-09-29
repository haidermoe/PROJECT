document.addEventListener('DOMContentLoaded', async function() {
  if (typeof requireAuth !== 'undefined') {
    const authValid = await requireAuth();
    if (!authValid) return;
  }
});

const bentoCategories = {
  kitchen: {
    title: '👨‍🍳 إدارة المطبخ والإنتاج (Kitchen & Stock)',
    links: [
      { url: '/inventory.html', name: 'المخزن وإدارة المواد الأولية', icon: 'fa-boxes-stacked' },
      { url: '/recipes.html', name: 'بطاقات الوصفات وتكاليف الوجبات', icon: 'fa-utensils' },
      { url: '/withdrawals.html', name: 'سحوبات المطبخ والمحطات', icon: 'fa-dolly' },
      { url: '/waste.html', name: 'تسجيل وإدارة الهدر والتوالف', icon: 'fa-trash-can' }
    ]
  },
  floor: {
    title: '🍽️ إدارة الصالة ونقاط البيع (Floor & Waiter POS)',
    links: [
      { url: '/floor-management.html', name: 'مخطط الصالة الرسومي والتحليلات', icon: 'fa-map-location-dot' },
      { url: '/waiter.html', name: 'شاشة طلبات الويترية وإشغال الطاولات', icon: 'fa-mobile-screen' },
      { url: '/settings.html', name: 'إعدادات طابعات الصالة والكاشير', icon: 'fa-print' }
    ]
  },
  finance: {
    title: '💰 المالية والمحاسبة والمشتريات (Finance & P2P)',
    links: [
      { url: '/accounting.html', name: 'شجرة الحسابات والقيود اليومية والتقارير', icon: 'fa-calculator' },
      { url: '/purchases.html', name: 'المشتريات وفواتير الموردين (Odoo P2P)', icon: 'fa-cart-shopping' }
    ]
  },
  hr: {
    title: '👥 الموارد البشرية وشؤون الموظفين (HR & Workforce)',
    links: [
      { url: '/hr-dashboard.html', name: 'لوحة تحكم الموارد البشرية', icon: 'fa-chart-pie' },
      { url: '/employees.html', name: 'سجل وحسابات الموظفين', icon: 'fa-users' },
      { url: '/payroll.html', name: 'مسيرات الرواتب والسلف', icon: 'fa-money-bill-wave' },
      { url: '/hr-attendance.html', name: 'تقرير البصمات وساعات العمل', icon: 'fa-fingerprint' },
      { url: '/shifts.html', name: 'جداول الورديات والشفتات', icon: 'fa-calendar-alt' },
      { url: '/leaves.html', name: 'طلبات وسجل الإجازات', icon: 'fa-plane' }
    ]
  },
  settings: {
    title: '⚙️ إعدادات النظام والأجهزة',
    links: [
      { url: '/settings.html', name: 'إعدادات النظام وصيانة الطابعات', icon: 'fa-cog' },
      { url: '/notifications.html', name: 'مركز الإشعارات والتنبيهات', icon: 'fa-bell' }
    ]
  }
};

window.openBentoModal = function(categoryKey) {
  const modal = document.getElementById('bentoModal');
  const title = document.getElementById('bentoModalTitle');
  const linksContainer = document.getElementById('bentoModalLinks');
  
  if(!modal || !bentoCategories[categoryKey]) return;
  
  const cat = bentoCategories[categoryKey];
  title.innerHTML = cat.title;
  
  linksContainer.innerHTML = '';
  cat.links.forEach(link => {
    const a = document.createElement('a');
    a.href = link.url;
    a.className = 'bento-link-item';
    a.innerHTML = `<i class="fa-solid ${link.icon}"></i> <span>${link.name}</span>`;
    linksContainer.appendChild(a);
  });
  
  modal.classList.add('active');
};

window.closeBentoModal = function() {
  const modal = document.getElementById('bentoModal');
  if(modal) modal.classList.remove('active');
};

window.addEventListener('click', (e) => {
  const modal = document.getElementById('bentoModal');
  if(modal && e.target === modal) {
    closeBentoModal();
  }
});

// Logout logic
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('/index.html');
});
