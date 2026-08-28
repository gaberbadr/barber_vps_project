import { useEffect, useState } from 'react';
import { 
  getDashboardStats, 
  getMonthlyReport, 
  getTopBarbers, 
  getTopServices,
  DashboardStatsDTO,
  MonthlyReportDTO,
  TopBarberDTO,
  TopServiceDTO
} from '../../api/admin.api';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStatsDTO | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportDTO[]>([]);
  const [topBarbers, setTopBarbers] = useState<TopBarberDTO[]>([]);
  const [topServices, setTopServices] = useState<TopServiceDTO[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'ThisMonth' | 'PreviousMonth' | 'ThisYear' | 'Custom'>('ThisYear');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [statsData, monthlyReportData, barbersData, servicesData] = await Promise.all([
          getDashboardStats().catch(() => null),
          getMonthlyReport({ period }).catch(() => []),
          getTopBarbers(5).catch(() => []),
          getTopServices(5).catch(() => [])
        ]);

        const extractArray = (obj: any): any[] => {
          if (!obj) return [];
          if (Array.isArray(obj)) return obj;
          if (obj.$values && Array.isArray(obj.$values)) return obj.$values;
          if (obj.items) return extractArray(obj.items);
          if (obj.Items) return extractArray(obj.Items);
          if (obj.data) return extractArray(obj.data);
          if (obj.Data) return extractArray(obj.Data);
          if (obj.result) return extractArray(obj.result);
          if (obj.Result) return extractArray(obj.Result);
          return [];
        };

        const unwrapStats = (obj: any): any => {
          // Backend wraps response in { success, data: { ... } }
          let target = obj;
          if (obj?.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) target = obj.data;
          else if (obj?.Data && typeof obj.Data === 'object') target = obj.Data;
          else if (obj?.result && typeof obj.result === 'object') target = obj.result;
          else if (obj?.Result && typeof obj.Result === 'object') target = obj.Result;

          if (!target) return null;

          return {
            // Map real backend field names → frontend DTO
            totalRevenue:    target.totalConfirmedRevenue   ?? target.totalRevenue   ?? target.TotalRevenue   ?? 0,
            totalBookings:   target.totalConfirmedBookings  ?? target.totalBookings  ?? target.TotalBookings  ?? 0,
            totalCustomers:  target.totalUsers              ?? target.totalCustomers ?? target.TotalCustomers ?? 0,
            totalBarbers:    target.totalBarbers            ?? target.TotalBarbers   ?? 0,
          };
        };

        if (statsData) setStats(unwrapStats(statsData));
        
        const mappedMonthly = extractArray(monthlyReportData).map(d => ({
          ...d,
          month: d.month ?? d.Month ?? '',
          totalRevenue: d.totalRevenue ?? d.TotalRevenue ?? 0,
          totalBookings: d.totalBookings ?? d.TotalBookings ?? 0
        }));
        setMonthlyData(mappedMonthly);
        
        const mappedBarbers = extractArray(barbersData).map(b => ({
          ...b,
          barberId: b.barberId ?? b.BarberId ?? b.id ?? b.Id,
          barberName: b.barberName ?? b.BarberName ?? b.fullName ?? b.FullName ?? 'Unknown',
          bookingCount: b.confirmedBookingCount ?? b.bookingCount ?? b.BookingCount ?? 0,
          revenue: b.totalRevenue ?? b.revenue ?? b.Revenue ?? 0
        }));
        setTopBarbers(mappedBarbers);
        
        const mappedServices = extractArray(servicesData).map(s => ({
          ...s,
          serviceId: s.serviceId ?? s.ServiceId ?? s.id ?? s.Id,
          serviceName: s.serviceName ?? s.ServiceName ?? s.name ?? s.Name ?? 'Unknown',
          requestCount: s.bookingCount ?? s.requestCount ?? s.RequestCount ?? 0,
          revenue: s.totalRevenue ?? s.revenue ?? s.Revenue ?? 0
        }));
        setTopServices(mappedServices);
      } catch (error) {
        console.error('Error fetching dashboard data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [period]);

  const maxRevenue = monthlyData.length 
    ? Math.max(...monthlyData.map(d => d.totalRevenue || 0)) 
    : 1;

  return (
    <div className="admin-dashboard">
      <header className="admin-page-header">
        <h1>نظرة عامة على الإدارة</h1>
      </header>

      {/* Metrics Row */}
      <div className="dashboard-metrics">
        <div className="metric-card">
          <span className="metric-title">إجمالي الإيرادات</span>
          {isLoading ? <div className="skeleton skeleton-title"></div> : <h3 className="metric-value">ج.م {stats?.totalRevenue?.toLocaleString() ?? '0'}</h3>}
        </div>
        <div className="metric-card">
          <span className="metric-title">إجمالي الحجوزات</span>
          {isLoading ? <div className="skeleton skeleton-title"></div> : <h3 className="metric-value">{stats?.totalBookings?.toLocaleString() ?? '0'}</h3>}
        </div>
        <div className="metric-card">
          <span className="metric-title">إجمالي العملاء</span>
          {isLoading ? <div className="skeleton skeleton-title"></div> : <h3 className="metric-value">{stats?.totalCustomers?.toLocaleString() ?? '0'}</h3>}
        </div>
        <div className="metric-card">
          <span className="metric-title">إجمالي الحلاقين</span>
          {isLoading ? <div className="skeleton skeleton-title"></div> : <h3 className="metric-value">{stats?.totalBarbers?.toLocaleString() ?? '0'}</h3>}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Main Chart Area */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2 className="panel-title">أداء الإيرادات</h2>
            <div className="panel-actions">
              <select value={period} onChange={(e) => setPeriod(e.target.value as any)}>
                <option value="ThisMonth">الشهر ده</option>
                <option value="PreviousMonth">الشهر اللي فات</option>
                <option value="ThisYear">السنة دي</option>
              </select>
            </div>
          </div>
          
          {isLoading ? (
            <div className="skeleton" style={{ height: '250px' }}></div>
          ) : (
            <div className="bar-chart-container">
              {monthlyData.length === 0 ? (
                <div style={{ margin: 'auto', color: '#6F6962' }}>مفيش بيانات متاحة للفترة دي.</div>
              ) : (
                monthlyData.map((data, idx) => {
                  const heightPercent = (data.totalRevenue / maxRevenue) * 100;
                  return (
                    <div className="bar-wrapper" key={idx}>
                      <div className="bar" style={{ height: `${heightPercent}%` }} title={`الإيرادات: ج.م ${data.totalRevenue}`}></div>
                      <span className="bar-label">{data.month.substring(0, 3)}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Side Widgets */}
        <div className="dashboard-widgets" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top Barbers */}
          <div className="dashboard-panel">
            <div className="panel-header">
              <h2 className="panel-title">أفضل الحلاقين</h2>
            </div>
            {isLoading ? (
              <div className="skeleton skeleton-text" style={{ height: '100px' }}></div>
            ) : (
              <ul className="list-widget">
                {topBarbers.map(barber => (
                  <li key={barber.barberId}>
                    <div>
                      <div className="list-item-main">{barber.barberName}</div>
                      <div className="list-item-sub">{barber.bookingCount} حجوزات</div>
                    </div>
                    <div className="list-item-value">ج.م {barber.revenue.toLocaleString()}</div>
                  </li>
                ))}
                {topBarbers.length === 0 && <li className="list-item-sub">مفيش بيانات متاحة</li>}
              </ul>
            )}
          </div>

          {/* Top Services */}
          <div className="dashboard-panel">
            <div className="panel-header">
              <h2 className="panel-title">أكثر الخدمات طلباً</h2>
            </div>
            {isLoading ? (
              <div className="skeleton skeleton-text" style={{ height: '100px' }}></div>
            ) : (
              <ul className="list-widget">
                {topServices.map(service => (
                  <li key={service.serviceId}>
                    <div>
                      <div className="list-item-main">{service.serviceName}</div>
                      <div className="list-item-sub">{service.requestCount} طلبات</div>
                    </div>
                    <div className="list-item-value">ج.م {service.revenue.toLocaleString()}</div>
                  </li>
                ))}
                {topServices.length === 0 && <li className="list-item-sub">مفيش بيانات متاحة</li>}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
