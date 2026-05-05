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
        const marker = new google.maps.Marker({
            position: { lat: loc.latitude, lng: loc.longitude },
            map: state.map,
            title: loc.driver_name,
            icon: {
                url: 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="#6366f1" stroke="white" stroke-width="3"/>
                        <text x="20" y="26" text-anchor="middle" fill="white" font-size="18">🏍</text>
                    </svg>
                `),
                scaledSize: new google.maps.Size(40, 40)
            }
        });
        
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="text-align:right;font-family:Cairo,sans-serif;padding:5px;">
                    <strong>${loc.driver_name}</strong><br>
                    <small>${loc.phone}</small>
                </div>
            `
        });
        
        marker.addListener('click', () => infoWindow.open(state.map, marker));
        state.markers[loc.driver_id] = marker;
    });
}

function centerMapOn(lat, lng) {
    if (state.map) {
        state.map.setCenter({ lat, lng });
        state.map.setZoom(15);
    }
}

// ==================== Actions ====================
async function cancelOrder(orderId) {
    if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;
    
    try {
        await apiCall(`/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'cancelled' })
        });
        showToast('تم إلغاء الطلب', 'success');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteDriver(driverId, driverName) {
    if (!confirm(`هل أنت متأكد من حذف السائق "${driverName}"؟`)) return;
    
    try {
        await apiCall(`/drivers/${driverId}`, { method: 'DELETE' });
        showToast('تم حذف السائق', 'success');
        loadDrivers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function blockDriver(driverId) {
    try {
        await apiCall(`/admin/drivers/${driverId}/block`, { method: 'POST' });
        showToast('تم حظر السائق', 'success');
        loadDrivers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function unblockDriver(driverId) {
    try {
        await apiCall(`/admin/drivers/${driverId}/unblock`, { method: 'POST' });
        showToast('تم إلغاء حظر السائق', 'success');
        loadDrivers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteRestaurant(restaurantId, restaurantName) {
    if (!confirm(`هل أنت متأكد من حذف المطعم "${restaurantName}"؟`)) return;
    
    try {
        await apiCall(`/restaurants/${restaurantId}`, { method: 'DELETE' });
        showToast('تم حذف المطعم', 'success');
        loadRestaurants();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteZone(zoneId) {
    if (!confirm('هل أنت متأكد من حذف هذه المنطقة؟')) return;
    
    try {
        await apiCall(`/admin/new-zones/${zoneId}`, { method: 'DELETE' });
        showToast('تم حذف المنطقة', 'success');
        loadZones();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function resolveComplaint(complaintId) {
    try {
        await apiCall(`/admin/complaints/${complaintId}/resolve`, { method: 'POST' });
        showToast('تم وضع علامة تم الحل', 'success');
        loadComplaints();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function assignOrderToDriver(orderId, driverId) {
    try {
        await apiCall(`/orders/${orderId}/assign`, {
            method: 'POST',
            body: JSON.stringify({ driver_id: driverId })
        });
        showToast('تم تعيين السائق', 'success');
        closeModal('assign-driver-modal');
        loadOrders();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== Modals ====================
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showAddDriverModal() {
    document.getElementById('add-driver-form').reset();
    showModal('add-driver-modal');
}

function showAddRestaurantModal() {
    document.getElementById('add-restaurant-form').reset();
    showModal('add-restaurant-modal');
}

function showAddZoneModal() {
    document.getElementById('add-zone-form').reset();
    showModal('add-zone-modal');
}

function showAssignModal(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    
    document.getElementById('assign-order-id').value = orderId;
    document.getElementById('assign-order-info').innerHTML = `
        <strong>الطلب:</strong> #${order.order_number || order.id.slice(0, 8)}<br>
        <strong>المنطقة:</strong> ${order.area_name || order.address}
    `;
    
    // Filter drivers by order zone
    const orderZone = order.restaurant_zone || 'الإذاعة';
    const availableDrivers = state.drivers.filter(d => {
        if (order.zone_id) {
            return d.assigned_zone_id === order.zone_id;
        }
        const driverZone = d.driver_zone || 'الإذاعة';
        return !d.assigned_zone_id && driverZone === orderZone;
    });
    
    // Sort: online first
    availableDrivers.sort((a, b) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0));
    
    const container = document.getElementById('available-drivers-list');
    container.innerHTML = availableDrivers.map(driver => `
        <button class="driver-chip ${driver.is_online ? 'online' : 'offline'}" 
                onclick="assignOrderToDriver('${orderId}', '${driver.id}')">
            ${driver.is_online ? '🟢' : '🔴'} ${driver.name}
        </button>
    `).join('') || '<p style="color:var(--gray);">لا يوجد سائقين متاحين في هذه المنطقة</p>';
    
    showModal('assign-driver-modal');
}

function showAddSubAreaModal(zoneId) {
    document.getElementById('add-subarea-form').reset();
    document.getElementById('subarea-zone-id').value = zoneId;
    showModal('add-subarea-modal');
}

// ==================== Tab Navigation ====================
function switchTab(tabName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.toggle('active', tab.id === `tab-${tabName}`);
    });
    
    // Update title
    const titles = {
        'dashboard': 'لوحة التحكم',
        'orders': 'الطلبات',
        'restaurants': 'المطاعم',
        'drivers': 'السائقين',
        'zones': 'المناطق',
        'map': 'الخريطة المباشرة',
        'complaints': 'الشكاوى',
        'notifications': 'الإشعارات'
    };
    document.getElementById('page-title').textContent = titles[tabName] || tabName;
    
    // Init map if needed
    if (tabName === 'map') {
        setTimeout(initMap, 100);
    }
}

// ==================== Form Handlers ====================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    await login(phone, password);
});

document.getElementById('add-driver-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        await apiCall('/admin/users', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('driver-name').value,
                phone: document.getElementById('driver-phone').value,
                password: document.getElementById('driver-password').value,
                role: 'driver',
                vehicle_type: document.getElementById('driver-vehicle').value,
                driver_zone: document.getElementById('driver-zone').value
            })
        });
        
        showToast('تم إضافة السائق بنجاح', 'success');
        closeModal('add-driver-modal');
        loadDrivers();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.getElementById('add-restaurant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        await apiCall('/admin/users', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('restaurant-name').value,
                phone: document.getElementById('restaurant-phone').value,
                password: document.getElementById('restaurant-password').value,
                role: 'restaurant',
                restaurant_zone: document.getElementById('restaurant-zone').value
            })
        });
        
        showToast('تم إضافة المطعم بنجاح', 'success');
        closeModal('add-restaurant-modal');
        loadRestaurants();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.getElementById('add-zone-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        await apiCall('/admin/new-zones', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('zone-name').value,
                distribution_type: document.getElementById('zone-distribution').value
            })
        });
        
        showToast('تم إضافة المنطقة بنجاح', 'success');
        closeModal('add-zone-modal');
        loadZones();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.getElementById('add-subarea-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const zoneId = document.getElementById('subarea-zone-id').value;
    
    try {
        await apiCall(`/admin/new-zones/${zoneId}/sub-areas`, {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('subarea-name').value,
                delivery_fee: parseFloat(document.getElementById('subarea-fee').value)
            })
        });
        
        showToast('تم إضافة المنطقة الفرعية بنجاح', 'success');
        closeModal('add-subarea-modal');
        loadZones();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.getElementById('send-notification-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        await apiCall('/admin/notifications/send', {
            method: 'POST',
            body: JSON.stringify({
                title: document.getElementById('notif-title').value,
                message: document.getElementById('notif-message').value,
                target: document.getElementById('notif-target').value
            })
        });
        
        showToast('تم إرسال الإشعار بنجاح', 'success');
        e.target.reset();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.getElementById('order-status-filter').addEventListener('change', renderOrdersTable);

// ==================== Event Listeners ====================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(item.dataset.tab);
    });
});

document.getElementById('logout-btn').addEventListener('click', logout);

// Close modals when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
