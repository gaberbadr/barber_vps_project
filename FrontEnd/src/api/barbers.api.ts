import api from './axiosInstance';

export interface WorkingHour {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  openingTime: string; // HH:mm:ss or HH:mm
  closingTime: string;
  isClosed: boolean;
}

export interface BarberDTO {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  bookingDurationMinutes: number;
  acceptingBookings: boolean;
  isActive: boolean;
  profilePictureUrl?: string;
  workingHours: WorkingHour[];
  cancellationPolicyHours?: number;
}

export interface AvailabilitySlot {
  startTime: string; // ISO string or HH:mm
  endTime: string;
}

export interface BarberBookingDTO {
  id: number;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  barberId: string;
  barberName: string;
  bookingDate: string; // ISO string
  startTime: string;
  endTime: string;
  subTotal: number;
  discount: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------
// PUBLIC ENDPOINTS
// ---------------------------------------------------------

const FALLBACK_BARBERS: BarberDTO[] = [
  {
    id: '1',
    fullName: 'Ahmed',
    phoneNumber: '',
    email: 'ahmed@mrx.com',
    bookingDurationMinutes: 30,
    acceptingBookings: true,
    isActive: true,
    profilePictureUrl: 'https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?auto=format&fit=crop&q=80&w=800',
    workingHours: [],
    cancellationPolicyHours: 2
  },
  {
    id: '2',
    fullName: 'Omar',
    phoneNumber: '',
    email: 'omar@mrx.com',
    bookingDurationMinutes: 30,
    acceptingBookings: true,
    isActive: true,
    profilePictureUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=800',
    workingHours: [],
    cancellationPolicyHours: 2
  },
  {
    id: '3',
    fullName: 'Yousef',
    phoneNumber: '',
    email: 'yousef@mrx.com',
    bookingDurationMinutes: 30,
    acceptingBookings: true,
    isActive: true,
    profilePictureUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=800',
    workingHours: [],
    cancellationPolicyHours: 2
  }
];

export const getBarbers = async (): Promise<BarberDTO[]> => {
  try {
    const response = await api.get('/api/barbers');
    const rawData = response.data?.data || response.data || [];
    
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

    const arrayData = extractArray(rawData);
    
    if (arrayData.length === 0) {
      return FALLBACK_BARBERS;
    }

    return arrayData.map((b: any) => ({
      id: b.id ?? b.Id ?? '',
      fullName: b.fullName ?? b.FullName ?? 'Unknown Barber',
      phoneNumber: b.phoneNumber ?? b.PhoneNumber ?? '',
      email: b.email ?? b.Email ?? '',
      bookingDurationMinutes: b.bookingDurationMinutes ?? b.BookingDurationMinutes ?? 30,
      acceptingBookings: b.acceptingBookings ?? b.AcceptingBookings ?? true,
      isActive: b.isActive ?? b.IsActive ?? true,
      profilePictureUrl: b.profilePictureUrl ?? b.ProfilePictureUrl ?? '',
      workingHours: b.workingHours ?? b.WorkingHours ?? [],
      cancellationPolicyHours: b.cancellationPolicyHours ?? b.CancellationPolicyHours ?? 2
    }));
  } catch (error) {
    console.warn('Failed to fetch barbers, using fallback data.', error);
    return FALLBACK_BARBERS;
  }
};

export const getBarberById = async (id: string): Promise<BarberDTO> => {
  try {
    const response = await api.get(`/api/barbers/${id}`);
    const b = response.data?.data || response.data || {};
    
    if (!b || Object.keys(b).length === 0) {
      throw new Error("Empty response");
    }

    return {
      id: b.id ?? b.Id ?? id,
      fullName: b.fullName ?? b.FullName ?? 'Unknown Barber',
      phoneNumber: b.phoneNumber ?? b.PhoneNumber ?? '',
      email: b.email ?? b.Email ?? '',
      bookingDurationMinutes: b.bookingDurationMinutes ?? b.BookingDurationMinutes ?? 30,
      acceptingBookings: b.acceptingBookings ?? b.AcceptingBookings ?? true,
      isActive: b.isActive ?? b.IsActive ?? true,
      profilePictureUrl: b.profilePictureUrl ?? b.ProfilePictureUrl ?? '',
      workingHours: b.workingHours ?? b.WorkingHours ?? [],
      cancellationPolicyHours: b.cancellationPolicyHours ?? b.CancellationPolicyHours ?? 2
    };
  } catch (error) {
    console.warn(`Failed to fetch barber ${id}, using fallback data.`, error);
    return FALLBACK_BARBERS.find(b => String(b.id) === String(id)) || FALLBACK_BARBERS[0];
  }
};

export const getBarberAvailability = async (id: string, date: string): Promise<AvailabilitySlot[]> => {
  try {
    const response = await api.get(`/api/barbers/${id}/availability`, {
      params: { date }
    });
    const rawData = response.data?.data || response.data || [];
    
    const extractArray = (obj: any): any[] => {
      if (!obj) return [];
      if (Array.isArray(obj)) return obj;
      if (obj.$values && Array.isArray(obj.$values)) return obj.$values;
      if (obj.items) return extractArray(obj.items);
      if (obj.data) return extractArray(obj.data);
      return [];
    };
    
    const arrayData = extractArray(rawData);

    return arrayData.map((s: any) => ({
      startTime: s.startTime ?? s.StartTime ?? s,
      endTime: s.endTime ?? s.EndTime ?? s
    }));
  } catch (error) {
    console.error(`Failed to fetch availability for barber ${id}:`, error);
    return [];
  }
};

// ---------------------------------------------------------
// BARBER PORTAL ENDPOINTS
// ---------------------------------------------------------

export const getBarberProfile = async (): Promise<BarberDTO> => {
  const response = await api.get('/api/barbers/me');
  const b = response.data?.data || response.data || {};
  
  return {
    id: b.id ?? b.Id ?? '',
    fullName: b.fullName ?? b.FullName ?? 'Unknown Barber',
    phoneNumber: b.phoneNumber ?? b.PhoneNumber ?? '',
    email: b.email ?? b.Email ?? '',
    bookingDurationMinutes: b.bookingDurationMinutes ?? b.BookingDurationMinutes ?? 30,
    acceptingBookings: b.acceptingBookings ?? b.AcceptingBookings ?? true,
    isActive: b.isActive ?? b.IsActive ?? true,
    profilePictureUrl: b.profilePictureUrl ?? b.ProfilePictureUrl ?? '',
    workingHours: b.workingHours ?? b.WorkingHours ?? [],
    cancellationPolicyHours: b.cancellationPolicyHours ?? b.CancellationPolicyHours ?? 2
  };
};

export const updateBookingSettings = async (settings: { bookingDurationMinutes: number; acceptingBookings: boolean }): Promise<void> => {
  await api.put('/api/barbers/me/booking-settings', settings);
};

export const updateWorkingHours = async (payload: { workingHours: WorkingHour[] }): Promise<void> => {
  await api.put('/api/barbers/me/working-hours', payload);
};

export const getBarberBookings = async (params: {
  fromDate?: string;
  toDate?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<PaginatedResult<BarberBookingDTO>> => {
  try {
    console.log('[getBarberBookings] Request params:', params);
    const response = await api.get('/api/barbers/me/bookings', { params });
    const raw = response.data;
    console.log('[getBarberBookings] Raw response from API:', raw);

    const extractArray = (obj: any): any[] => {
      if (!obj) return [];
      if (Array.isArray(obj)) return obj;
      
      // Known wrappers
      if (obj.$values && Array.isArray(obj.$values)) return obj.$values;
      if (obj.items && Array.isArray(obj.items)) return obj.items;
      if (obj.Items && Array.isArray(obj.Items)) return obj.Items;
      
      // Recursive unwrap
      if (obj.data) return extractArray(obj.data);
      if (obj.Data) return extractArray(obj.Data);
      if (obj.result) return extractArray(obj.result);
      if (obj.Result) return extractArray(obj.Result);
      if (obj.value) return extractArray(obj.value);
      if (obj.Value) return extractArray(obj.Value);
      
      // Dynamic fallback: search the object for any array
      if (typeof obj === 'object') {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (Array.isArray(obj[key])) {
              return obj[key];
            }
          }
        }
      }
      return [];
    };

    const extractedItems = extractArray(raw);
    const items = extractedItems.map((b: any) => ({
      id: b.id ?? b.Id,
      customerId: b.customerId ?? b.CustomerId,
      customerName: b.customerName ?? b.CustomerName ?? 'Unknown Customer',
      customerPhone: b.customerPhone ?? b.CustomerPhone ?? b.phoneNumber ?? b.PhoneNumber ?? '',
      barberId: b.barberId ?? b.BarberId,
      barberName: b.barberName ?? b.BarberName,
      bookingDate: b.bookingDate ?? b.BookingDate,
      startTime: b.startTime ?? b.StartTime,
      endTime: b.endTime ?? b.EndTime,
      subTotal: b.subTotal ?? b.SubTotal ?? 0,
      discount: b.discount ?? b.Discount ?? 0,
      totalPrice: b.totalPrice ?? b.TotalPrice ?? 0,
      status: b.status ?? b.Status,
      createdAt: b.createdAt ?? b.CreatedAt,
    }));
    console.log('[getBarberBookings] Extracted items:', items);

    // Try to find pagination data if it exists in raw or raw.data
    const root = raw?.data || raw || {};
    const totalCount = root.totalCount ?? root.TotalCount ?? items.length;
    const pageNumber = root.pageNumber ?? root.PageNumber ?? params.pageNumber ?? 1;
    const pageSize = root.pageSize ?? root.PageSize ?? params.pageSize ?? items.length;
    const totalPages = root.totalPages ?? root.TotalPages ?? 1;

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages
    };
  } catch (error) {
    console.error('[getBarberBookings] Error fetching bookings:', error);
    return { items: [], totalCount: 0, pageNumber: 1, pageSize: 0, totalPages: 0 };
  }
};
