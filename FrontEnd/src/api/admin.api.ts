import axiosInstance from './axiosInstance';


// ─── Shared Types ───────────────────────────────────────────────
export interface PaginatedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// ─── Dashboard Stats ────────────────────────────────────────────
export interface DashboardStatsDTO {
  totalBookings: number;
  totalRevenue: number;
  totalCustomers: number;
  totalBarbers: number;
  completedBookings: number;
  cancelledBookings: number;
}

export const getDashboardStats = async (): Promise<DashboardStatsDTO> => {
  // Returns { success, data: { totalConfirmedRevenue, totalConfirmedBookings, totalUsers, ... } }
  const { data: raw } = await axiosInstance.get<any>('/api/admin/dashboard');
  // Return raw so AdminDashboard.unwrapStats can read the real field names
  return raw as DashboardStatsDTO;
};

// ─── Monthly Report ─────────────────────────────────────────────
export interface MonthlyReportDTO {
  month: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
}

export interface MonthlyReportParams {
  period?: 'ThisMonth' | 'PreviousMonth' | 'ThisYear' | 'Custom';
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
}

export const getMonthlyReport = async (params: MonthlyReportParams = {}): Promise<MonthlyReportDTO[]> => {
  const { data: raw } = await axiosInstance.get<any>('/api/admin/dashboard/monthly', { params });
  // Unwrap { success, data: [...] } envelope
  const arr = raw?.data ?? raw?.Data ?? raw;
  if (Array.isArray(arr)) return arr;
  if (arr?.$values && Array.isArray(arr.$values)) return arr.$values;
  return [];
};

// ─── Top Barbers ────────────────────────────────────────────────
export interface TopBarberDTO {
  barberId: string | number;
  barberName: string;
  bookingCount: number;
  revenue: number;
}

export const getTopBarbers = async (count: number = 10): Promise<TopBarberDTO[]> => {
  const { data: raw } = await axiosInstance.get<any>('/api/admin/dashboard/top-barbers', { params: { count } });
  const arr = raw?.data ?? raw?.Data ?? raw;
  if (Array.isArray(arr)) return arr;
  if (arr?.$values && Array.isArray(arr.$values)) return arr.$values;
  return [];
};

// ─── Top Services ───────────────────────────────────────────────
export interface TopServiceDTO {
  serviceId: string | number;
  serviceName: string;
  requestCount: number;
  revenue: number;
}

export const getTopServices = async (count: number = 10): Promise<TopServiceDTO[]> => {
  const { data: raw } = await axiosInstance.get<any>('/api/admin/dashboard/top-services', { params: { count } });
  const arr = raw?.data ?? raw?.Data ?? raw;
  if (Array.isArray(arr)) return arr;
  if (arr?.$values && Array.isArray(arr.$values)) return arr.$values;
  return [];
};

// ─── Bookings Management ────────────────────────────────────────
export interface BookingDTO {
  id: string | number;
  customerId: string | number;
  customerName: string;
  barberId: string | number;
  barberName: string;
  bookingDate: string;
  status: string;
  totalPrice: number;
}

export interface BookingsFilterParams {
  date?: string;
  barberId?: string | number;
  customerId?: string | number;
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const getBookings = async (params: BookingsFilterParams): Promise<PaginatedResult<BookingDTO>> => {
  const { data: raw } = await axiosInstance.get<any>('/api/admin/bookings', { params });

  // Backend returns: { success, data: { pageSize, pageIndex, count, data: [...] } }
  const envelope = raw?.data ?? raw?.Data ?? raw;

  // Inner array lives in envelope.data (nested) or envelope.items
  const extractItems = (obj: any): any[] => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    if (obj.$values && Array.isArray(obj.$values)) return obj.$values;
    // The real backend puts items in envelope.data when envelope itself is the paged object
    if (obj.data && Array.isArray(obj.data)) return obj.data;
    if (obj.items && Array.isArray(obj.items)) return obj.items;
    if (obj.Items && Array.isArray(obj.Items)) return obj.Items;
    return [];
  };

  const items = extractItems(envelope);
  const totalCount = envelope?.count ?? envelope?.totalCount ?? envelope?.TotalCount ?? items.length;
  const pageNumber  = envelope?.pageIndex ?? envelope?.pageNumber ?? envelope?.PageNumber ?? 1;
  const pageSize    = envelope?.pageSize  ?? envelope?.PageSize   ?? items.length;
  const totalPages  = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1;

  return { items, totalCount, pageNumber, pageSize, totalPages };
};


// ─── Users Management ───────────────────────────────────────────
export interface UserDTO {
  id: string | number;
  fullName: string;
  email: string;
  phone?: string;
  createdDate: string;
  isActive: boolean;
}

export interface UsersFilterParams {
  searchTerm?: string;
  isActive?: boolean | string;
  pageNumber?: number;
  pageSize?: number;
}

export const getUsers = async (params: UsersFilterParams): Promise<PaginatedResult<UserDTO>> => {
  const { data } = await axiosInstance.get<PaginatedResult<UserDTO>>('/api/admin/users', { params });
  return data;
};

export const blockUser = async (id: string | number): Promise<void> => {
  await axiosInstance.put(`/api/admin/users/${id}/block`);
};

export const unblockUser = async (id: string | number): Promise<void> => {
  await axiosInstance.put(`/api/admin/users/${id}/unblock`);
};

// ─── Coupons Management ─────────────────────────────────────────
export interface CouponDTO {
  id: number;
  code: string;
  discountPercentage: number;
  startDate: string;
  expiryDate: string;
  usageLimit: number | null;
  timesUsed: number;
  isActive: boolean;
}

export interface CreateCouponRequest {
  code: string;
  discountPercentage: number;
  startDate: string;
  expiryDate: string;
  usageLimit?: number | null;
}

export const getCoupons = async (params: { isActive?: boolean; pageNumber?: number; pageSize?: number }): Promise<PaginatedResult<CouponDTO>> => {
  const { data } = await axiosInstance.get<PaginatedResult<CouponDTO>>('/api/admin/coupons', { params });
  return data;
};

export const createCoupon = async (payload: CreateCouponRequest): Promise<CouponDTO> => {
  const { data } = await axiosInstance.post<CouponDTO>('/api/admin/coupons', payload);
  return data;
};

export const deleteCoupon = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/api/admin/coupons/${id}`);
};

// ─── Barbers Management ─────────────────────────────────────────
export interface AdminBarberDTO {
  id: string;
  fullName: string;
  phoneNumber?: string;
  email: string;
  bookingDurationMinutes: number;
  acceptingBookings: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateBarberRequest {
  fullName: string;
  email: string;
  phoneNumber: string;   // Required per API spec v2.4.0
  bookingDurationMinutes: number;
  acceptingBookings: boolean;
}

export const getAdminBarbers = async (): Promise<AdminBarberDTO[]> => {
  const { data } = await axiosInstance.get<AdminBarberDTO[]>('/api/admin/barbers');
  return data;
};

export const createBarber = async (payload: CreateBarberRequest): Promise<AdminBarberDTO> => {
  const { data } = await axiosInstance.post<AdminBarberDTO>('/api/admin/barbers', payload);
  return data;
};

export const deleteBarber = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/barbers/${id}`);
};

// ─── Global Booking Settings ────────────────────────────────────
export interface GlobalSettingsDTO {
  maximumBookingAdvanceDays: number;
  cancellationWindowHours: number;
}

export const getSettings = async (): Promise<GlobalSettingsDTO> => {
  const { data } = await axiosInstance.get<GlobalSettingsDTO>('/api/admin/settings');
  return data;
};

export const updateSettings = async (payload: GlobalSettingsDTO): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', payload);
};

// ─── Shop Working Hours ─────────────────────────────────────────
export interface ShopWorkingHourDTO {
  id: number;
  dayOfWeek: number;
  dayName: string;
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
}

export interface UpdateShopHoursRequest {
  workingHours: {
    dayOfWeek: number;
    openingTime: string;
    closingTime: string;
    isClosed: boolean;
  }[];
}

export const getShopHours = async (): Promise<ShopWorkingHourDTO[]> => {
  const { data } = await axiosInstance.get<ShopWorkingHourDTO[]>('/api/admin/shop-hours');
  return data;
};

export const updateShopHours = async (payload: UpdateShopHoursRequest): Promise<void> => {
  await axiosInstance.put('/api/admin/shop-hours', payload);
};

// ─── Services Management ─────────────────────────────────────────
export interface AdminServiceDTO {
  id: number;
  name: string;
  description?: string;
  price: number;
  isActive: boolean;
}

export interface CreateServiceRequest {
  name: string;
  description?: string;
  price: number;
  isActive: boolean;
}

export const getAdminServices = async (): Promise<AdminServiceDTO[]> => {
  const { data } = await axiosInstance.get<AdminServiceDTO[]>('/api/services');
  return data;
};

export const createAdminService = async (payload: CreateServiceRequest): Promise<AdminServiceDTO> => {
  const { data } = await axiosInstance.post<AdminServiceDTO>('/api/admin/services', payload);
  return data;
};

export const updateAdminService = async (id: number, payload: CreateServiceRequest): Promise<void> => {
  await axiosInstance.put(`/api/admin/services/${id}`, payload);
};

export const deleteAdminService = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/api/admin/services/${id}`);
};

