import api from './axiosInstance';

// ─── Booking Status Enum ────────────────────────────────────────
// 1: Confirmed | 2: Cancelled | 3: Arrived | 4: DidNotArrive
export enum BookingStatus {
  Confirmed   = 1,
  Cancelled   = 2,
  Arrived     = 3,
  DidNotArrive = 4,
}

export interface UpdateBookingStatusRequest {
  status: BookingStatus;
}

export interface CreateBookingRequest {
  barberId: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string;   // HH:MM:SS
  serviceIds: number[];
  couponCode?: string;
  fullName: string;
  phoneNumber: string;
}

export interface BookingServiceDTO {
  serviceId: number;
  serviceName: string;
  price: number;
}

export interface BookingDTO {
  id: number;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  barberId: string;
  barberName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  subTotal: number;
  discount: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  services: BookingServiceDTO[];
}

export interface PaginatedBookings {
  items: BookingDTO[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// Robust array extraction to handle different .NET wrappers
export const extractArray = (obj: any): any[] => {
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

// ---------------------------------------------------------
// PUBLIC ENDPOINTS
// ---------------------------------------------------------

// Helper to map PascalCase backend models to camelCase frontend DTOs
const mapBookingDTO = (b: any): BookingDTO => ({
  id: b.id ?? b.Id,
  customerId: b.customerId ?? b.CustomerId,
  customerName: b.customerName ?? b.CustomerName,
  customerPhone: b.customerPhone ?? b.CustomerPhone,
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
  services: extractArray(b.services ?? b.Services).map((s: any) => ({
    serviceId: s.serviceId ?? s.ServiceId,
    serviceName: s.serviceName ?? s.ServiceName,
    price: s.price ?? s.Price ?? 0
  }))
});

// ---------------------------------------------------------
// BOOKINGS ENDPOINTS (Requires Auth)
// ---------------------------------------------------------

export const createBooking = async (payload: CreateBookingRequest): Promise<BookingDTO> => {
  const response = await api.post('/api/bookings', payload);
  return mapBookingDTO(response.data);
};

export const getUpcomingBookings = async (): Promise<BookingDTO[]> => {
  const response = await api.get('/api/bookings/my/upcoming');
  return extractArray(response.data).map(mapBookingDTO);
};

export const getBookingHistory = async (pageNumber = 1, pageSize = 10): Promise<PaginatedBookings> => {
  const response = await api.get('/api/bookings/my/history', {
    params: { pageNumber, pageSize }
  });
  
  const rawResponse = response.data as any;
  const items = extractArray(rawResponse).map(mapBookingDTO);
  
  return {
    items,
    totalCount: rawResponse?.totalCount ?? rawResponse?.TotalCount ?? items.length,
    pageNumber: rawResponse?.pageNumber ?? rawResponse?.PageNumber ?? pageNumber,
    pageSize: rawResponse?.pageSize ?? rawResponse?.PageSize ?? pageSize,
    totalPages: rawResponse?.totalPages ?? rawResponse?.TotalPages ?? 1
  };
};

export const getBookingById = async (id: number): Promise<BookingDTO> => {
  const response = await api.get(`/api/bookings/${id}`);
  return mapBookingDTO(response.data);
};

export const cancelBooking = async (id: number): Promise<void> => {
  await api.post(`/api/bookings/${id}/cancel`);
};

/**
 * PATCH /api/Bookings/{id}/status
 * Roles: Admin, Barber
 * Updates the booking status to one of: Confirmed (1), Cancelled (2), Arrived (3), DidNotArrive (4).
 */
export const updateBookingStatus = async (
  id: number,
  status: BookingStatus
): Promise<void> => {
  await api.patch(`/api/Bookings/${id}/status`, { status });
};
