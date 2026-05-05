// ==================== Configuration ====================
const API_BASE = 'https://spectacular-presence-production.up.railway.app/api';

// ==================== State ====================
let state = {
    token: null,
    user: null,
    orders: [],
    drivers: [],
    restaurants: [],
    zones: [],
    newZones: [],
    complaints: [],
    liveLocations: [],
    stats: null,
    map: null,
    markers: {}
};

// ==================== Utility Functions ====================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            let errorMsg = 'حدث خطأ';
            try {
                const errorData = await response.json();
                errorMsg = errorData.detail || errorData.message || 'حدث خطأ';
            } catch (e) {
                errorMsg = `خطأ ${response.status}`;
            }
            throw new Error(errorMsg);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusLabel(status) {
    const labels = {
        'pending': 'قيد الانتظار',
        'picked_up': 'تم الاستلام',
        'on_the_way': 'في الطريق',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغي'
    };
    return labels[status] || status;
}

// ==================== Authentication ====================
async function login(phone, password) {
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = 'جاري تسجيل الدخول...';
    
    try {
        console.log('Attempting login with phone:', phone);
        
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone, password })
        });
        
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            errorEl.textContent = data.detail || 'فشل تسجيل الدخول';
            return;
        }
        
        if (data.user.role !== 'admin') {
            errorEl.textContent = 'هذه اللوحة للمدراء فقط';
            return;
        }
        
        state.token = data.token;
        state.user = data.user;
        
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
        
        errorEl.textContent = '';
        showDashboard();
        loadAllData();
        
    } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = 'فشل الاتصال بالسيرفر - تأكد من اتصال الإنترنت';
    }
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function checkAuth() {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    
    if (token && user) {
        state.token = token;
        state.user = JSON.parse(user);
        showDashboard();
        loadAllData();
    }
}

function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    document.getElementById('admin-name').textContent = state.user?.name || 'المدير';
}

// ==================== Data Loading ====================
async function loadAllData() {
    try {
        await Promise.all([
            loadStats(),
            loadOrders(),
            loadDrivers(),
            loadRestaurants(),
            loadZones(),
            loadComplaints()
        ]);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function refreshData() {
    const btn = document.querySelector('.btn-refresh i');
    btn.classList.add('fa-spin');
    await loadAllData();
    setTimeout(() => btn.classList.remove('fa-spin'), 500);
    showToast('تم تحديث البيانات', 'success');
}

async function loadStats() {
    try {
        const stats = await apiCall('/admin/stats');
        state.stats = stats;
        
        document.getElementById('stat-today-orders').textContent = stats.today_orders || 0;
        document.getElementById('stat-today-revenue').textContent = `${stats.today_revenue || 0} JOD`;
        document.getElementById('stat-active-drivers').textContent = stats.active_drivers || 0;
        document.getElementById('stat-week-orders').textContent = stats.week_orders || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadOrders() {
    try {
        const orders = await apiCall('/orders');
        state.orders = orders;
        
        const pendingCount = orders.filter(o => o.status === 'pending').length;
        document.getElementById('orders-badge').textContent = pendingCount;
        
        renderOrdersTable();
        renderRecentOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

async function loadDrivers() {
    try {
        const drivers = await apiCall('/drivers');
        state.drivers = drivers;
        
        renderDriversTable();
        renderActiveDrivers();
    } catch (error) {
        console.error('Error loading drivers:', error);
    }
}

async function loadRestaurants() {
    try {
        const restaurants = await apiCall('/restaurants');
        state.restaurants = restaurants;
        
        renderRestaurantsTable();
    } catch (error) {
        console.error('Error loading restaurants:', error);
    }
}

async function loadZones() {
    try {
        const [zones, newZones] = await Promise.all([
            apiCall('/admin/zones'),
            apiCall('/admin/new-zones').catch(() => [])
        ]);
        
        state.zones = zones;
        state.newZones = newZones;
        
        renderZones();
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

async function loadComplaints() {
    try {
        const complaints = await apiCall('/admin/complaints');
        state.complaints = complaints;
        
        renderComplaints();
    } catch (error) {
        console.error('Error loading complaints:', error);
    }
}

async function loadLiveLocations() {
    try {
        const locations = await apiCall('/locations/live');
        state.liveLocations = locations;
        
        updateMapMarkers();
        renderMapDriversList();
    } catch (error) {
        console.error('Error loading live locations:', error);
    }
}

// ==================== Render Functions ====================
function renderOrdersTable() {
    const tbody = document.getElementById('orders-table-body');
    const filter = document.getElementById('order-status-filter').value;
    
    let filteredOrders = state.orders;
    if (filter !== 'all') {
        filteredOrders = state.orders.filter(o => o.status === filter);
    }
    
    tbody.innerHTML = filteredOrders.map(order => `
        <tr>
            <td><strong>#${order.order_number || order.id.slice(0, 8)}</strong></td>
            <td>${order.restaurant_name}</td>
            <td>${order.customer_name}</td>
            <td>${order.area_name || order.address || '-'}</td>
            <td>${order.delivery_fee || 0} JOD</td>
            <td>${order.assigned_driver_name || '<span class="status-badge status-pending">غير معين</span>'}</td>
            <td><span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span></td>
            <td>
                ${!order.assigned_driver_id && order.status === 'pending' ? `
                    <button class="btn-icon success" onclick="showAssignModal('${order.id}')" title="تعيين سائق">
                        <i class="fas fa-user-plus"></i>
                    </button>
                ` : ''}
                <button class="btn-icon danger" onclick="cancelOrder('${order.id}')" title="إلغاء">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderRecentOrders() {
    const container = document.getElementById('recent-orders');
    const recentOrders = state.orders.slice(0, 5);
    
    container.innerHTML = recentOrders.map(order => `
        <div class="order-item">
            <div class="order-info">
                <h4>#${order.order_number || order.id.slice(0, 8)} - ${order.restaurant_name}</h4>
                <p>${order.customer_name} • ${order.area_name || order.address}</p>
            </div>
            <span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span>
        </div>
    `).join('') || '<p style="text-align:center;color:var(--gray);">لا توجد طلبات</p>';
}

function renderDriversTable() {
    const tbody = document.getElementById('drivers-table-body');
    
    tbody.innerHTML = state.drivers.map(driver => `
        <tr>
            <td><strong>${driver.name}</strong></td>
            <td>${driver.phone}</td>
            <td>${driver.driver_zone || 'غير محدد'}</td>
            <td>${driver.vehicle_type || '-'}</td>
            <td>${driver.deliveries_count || 0}</td>
            <td>
                <span class="status-badge ${driver.is_online ? 'status-online' : 'status-offline'}">
                    ${driver.is_online ? '🟢 متصل' : '🔴 غير متصل'}
                </span>
            </td>
            <td>
                ${driver.is_blocked ? `
                    <button class="btn-icon success" onclick="unblockDriver('${driver.id}')" title="إلغاء الحظر">
                        <i class="fas fa-unlock"></i>
                    </button>
                ` : `
                    <button class="btn-icon" onclick="blockDriver('${driver.id}')" title="حظر">
                        <i class="fas fa-ban"></i>
                    </button>
                `}
                <button class="btn-icon danger" onclick="deleteDriver('${driver.id}', '${driver.name}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderActiveDrivers() {
    const container = document.getElementById('active-drivers-list');
    const activeDrivers = state.drivers.filter(d => d.is_online);
    
    container.innerHTML = activeDrivers.map(driver => `
        <div class="driver-item">
            <div class="driver-info-card">
                <h4>${driver.name}</h4>
                <p>${driver.vehicle_type || 'دراجة نارية'} • ${driver.driver_zone || 'غير محدد'}</p>
            </div>
            <span class="status-badge status-online">متصل</span>
        </div>
    `).join('') || '<p style="text-align:center;color:var(--gray);">لا يوجد سائقين متصلين</p>';
}

function renderRestaurantsTable() {
    const tbody = document.getElementById('restaurants-table-body');
    
    tbody.innerHTML = state.restaurants.map(restaurant => `
        <tr>
            <td><strong>${restaurant.name}</strong></td>
            <td>${restaurant.phone}</td>
            <td>${restaurant.restaurant_zone || 'غير محدد'}</td>
            <td>${restaurant.orders_count || 0}</td>
            <td>
                <span class="status-badge ${restaurant.is_active ? 'status-online' : 'status-offline'}">
                    ${restaurant.is_active ? 'نشط' : 'غير نشط'}
                </span>
            </td>
            <td>
                <button class="btn-icon danger" onclick="deleteRestaurant('${restaurant.id}', '${restaurant.name}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderZones() {
    const container = document.getElementById('zones-list');
    
    // Legacy zones
    const legacyZones = [
        { name: 'الإذاعة', type: 'legacy', drivers: state.drivers.filter(d => d.driver_zone === 'الإذاعة').length },
        { name: 'المقابلين', type: 'legacy', drivers: state.drivers.filter(d => d.driver_zone === 'المقابلين').length }
    ];
    
    let html = legacyZones.map(zone => `
        <div class="zone-card">
            <div class="zone-header">
                <h3><i class="fas fa-map-marker-alt"></i> ${zone.name}</h3>
                <span class="zone-type">منطقة قديمة</span>
            </div>
            <div class="zone-body">
                <div class="zone-stats">
                    <div class="zone-stat">
                        <div class="zone-stat-value">${zone.drivers}</div>
                        <div class="zone-stat-label">سائقين</div>
                    </div>
                </div>
                <p style="color:var(--gray);font-size:13px;">
                    <i class="fas fa-hand-pointer"></i> التوزيع اليدوي
                </p>
            </div>
        </div>
    `).join('');
    
    // New zones
    html += state.newZones.map(zone => `
        <div class="zone-card">
            <div class="zone-header">
                <h3><i class="fas fa-map-marked-alt"></i> ${zone.name}</h3>
                <span class="zone-type">${zone.distribution_type === 'smart_round_robin' ? 'تلقائي' : 'يدوي'}</span>
            </div>
            <div class="zone-body">
                <div class="zone-stats">
                    <div class="zone-stat">
                        <div class="zone-stat-value">${zone.drivers_count || 0}</div>
                        <div class="zone-stat-label">سائقين</div>
                    </div>
                    <div class="zone-stat">
                        <div class="zone-stat-value">${zone.sub_areas?.length || 0}</div>
                        <div class="zone-stat-label">مناطق فرعية</div>
                    </div>
                </div>
                
                ${zone.sub_areas && zone.sub_areas.length > 0 ? `
                    <div class="sub-areas-list">
                        ${zone.sub_areas.slice(0, 3).map(sa => `
                            <div class="sub-area-item">
                                <span class="sub-area-name">${sa.name}</span>
                                <span class="sub-area-fee">${sa.delivery_fee} JOD</span>
                            </div>
                        `).join('')}
                        ${zone.sub_areas.length > 3 ? `<p style="color:var(--gray);font-size:12px;text-align:center;">+${zone.sub_areas.length - 3} مناطق أخرى</p>` : ''}
                    </div>
                ` : ''}
                
                <div class="zone-actions">
                    <button class="btn-secondary" onclick="showAddSubAreaModal('${zone.id}')">
                        <i class="fas fa-plus"></i> إضافة منطقة فرعية
                    </button>
                    <button class="btn-danger" onclick="deleteZone('${zone.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderComplaints() {
    const tbody = document.getElementById('complaints-table-body');
    
    tbody.innerHTML = state.complaints.map(complaint => `
        <tr>
            <td>${complaint.user_name || 'مجهول'}</td>
            <td>${complaint.type || 'عام'}</td>
            <td>${complaint.message}</td>
            <td>${formatDate(complaint.created_at)}</td>
            <td>
                <span class="status-badge ${complaint.resolved ? 'status-delivered' : 'status-pending'}">
                    ${complaint.resolved ? 'تم الحل' : 'قيد المراجعة'}
                </span>
            </td>
            <td>
                ${!complaint.resolved ? `
                    <button class="btn-icon success" onclick="resolveComplaint('${complaint.id}')" title="تم الحل">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;">لا توجد شكاوى</td></tr>';
}

function renderMapDriversList() {
    const container = document.getElementById('map-drivers-list');
    
    container.innerHTML = state.liveLocations.map(loc => `
        <div class="map-driver-item" onclick="centerMapOn(${loc.latitude}, ${loc.longitude})">
            <div class="map-driver-avatar">
                <i class="fas fa-motorcycle"></i>
            </div>
            <div class="map-driver-info">
                <h4>${loc.driver_name}</h4>
                <p>${loc.phone}</p>
            </div>
        </div>
    `).join('') || '<p style="text-align:center;color:var(--gray);">لا يوجد سائقين متصلين</p>';
}

// ==================== Map Functions ====================
function initMap() {
    if (state.map) return;
    
    const mapElement = document.getElementById('live-map');
    if (!mapElement) return;
    
    state.map = new google.maps.Map(mapElement, {
        center: { lat: 31.9454, lng: 35.9284 },
        zoom: 12,
        styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] }
        ]
    });
    
    loadLiveLocations();
    
    // Auto-refresh every 10 seconds
    setInterval(loadLiveLocations, 10000);
}

function updateMapMarkers() {
    if (!state.map) return;
    
    // Clear old markers
    Object.values(state.markers).forEach(marker => marker.setMap(null));
    state.markers = {};
    
    // Add new markers
    state.liveLocations.forEach(loc => {
  // ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
    // 1. التحقق من الجلسة السابقة
    checkAuth();

    // 2. إذا لم يكن هناك توكن، تأكد من إظهار شاشة تسجيل الدخول
    if (!state.token) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    // 3. تفعيل أزرار القائمة الجانبية (Sidebar) يدوياً للتأكد
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');
            switchTab(tabName);
        };
    });
});     

