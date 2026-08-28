import axiosInstance from './axiosInstance';

export interface ServiceDTO {
  id: number;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  createdAt: string;
}

const FALLBACK_SERVICES: ServiceDTO[] = [
  {
    id: 1,
    name: 'The Signature Cut',
    description: 'A tailored haircut finished with a hot towel and premium styling.',
    price: 45,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Luxury Beard Trim',
    description: 'Sculpting, straight razor line-up, and essential oil treatment.',
    price: 30,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    name: 'The MR.X Experience',
    description: 'Full service haircut, beard styling, facial mask, and scalp massage.',
    price: 85,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export const getPublicServices = async (): Promise<ServiceDTO[]> => {
  try {
    const response = await axiosInstance.get('/api/services');
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
      return FALLBACK_SERVICES;
    }
    
    return arrayData.map((s: any) => ({
      id: s.id ?? s.Id ?? 0,
      name: s.name ?? s.Name ?? 'Service',
      description: s.description ?? s.Description ?? '',
      price: s.price ?? s.Price ?? 0,
      isActive: s.isActive ?? s.IsActive ?? true,
      createdAt: s.createdAt ?? s.CreatedAt ?? new Date().toISOString()
    }));
  } catch (error) {
    console.warn('Failed to fetch services, using fallback data.', error);
    return FALLBACK_SERVICES;
  }
};
