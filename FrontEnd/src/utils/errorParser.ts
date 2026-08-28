

export const parseApiError = (error: any, defaultMsg: string = 'حدث خطأ غير متوقع. جرب تاني.'): string => {
  if (error?.code === 'ERR_NETWORK') {
    return 'السيرفر مش شغال دلوقتي. اتأكد من النت وجرب تاني.';
  }

  const status = error?.response?.status;
  const resData = error?.response?.data;
  let backendMsg = '';

  if (typeof resData === 'string' && resData.trim() !== '') {
    backendMsg = resData;
  } else if (resData?.message) {
    backendMsg = resData.message;
  } else if (resData?.detail) {
    backendMsg = resData.detail;
  } else if (resData?.title) {
    backendMsg = resData.title;
    if (resData.errors) {
      const firstErr = Object.values(resData.errors)[0] as string[];
      if (firstErr && firstErr.length > 0) backendMsg += ': ' + firstErr[0];
    }
  } else if (resData?.Message) {
    backendMsg = resData.Message;
  }

  if (!backendMsg) {
    if (status === 409) return 'فيه تعارض في البيانات (ممكن الكود مستخدم أو الميعاد محجوز).';
    if (status === 401) return 'جلستك انتهت، يا ريت تسجل دخول تاني.';
    if (status === 403) return 'معندكش صلاحية تعمل كده.';
    if (status === 404) return 'البيانات دي مش موجودة.';
    if (status === 500) return 'مشكلة في السيرفر الداخلي. هنحلها قريب.';
    return defaultMsg;
  }

  const lowerMsg = backendMsg.toLowerCase();

  // الحجز والتعارض
  if (lowerMsg.includes('already has an appointment') || lowerMsg.includes('already booked') || lowerMsg.includes('already have an appointment') || lowerMsg.includes('overlap')) {
    return 'إنت بالفعل حجزت ميعاد في اليوم ده.';
  }
  if (lowerMsg.includes('not available') || lowerMsg.includes('time slot')) {
    return 'الميعاد ده مبقاش متاح. اختار ميعاد تاني.';
  }
  
  // الكوبونات
  if (lowerMsg.includes('coupon') && (lowerMsg.includes('exist') || lowerMsg.includes('already'))) {
    return 'الكوبون ده موجود قبل كده.';
  }
  if (lowerMsg.includes('coupon') && lowerMsg.includes('expired')) {
    return 'الكوبون ده منتهي الصلاحية.';
  }
  if (lowerMsg.includes('coupon') && lowerMsg.includes('invalid')) {
    return 'الكوبون ده مش صحيح.';
  }
  
  // الحذف والارتباط
  if (lowerMsg.includes('linked to existing bookings') || lowerMsg.includes('has existing bookings') || lowerMsg.includes('foreign key constraint')) {
    return 'مش هينفع نمسح العنصر ده عشان مربوط بحجوزات موجودة. تقدر تعطله بدل ما تمسحه.';
  }
  
  // التسجيل والدخول
  if (lowerMsg.includes('unauthorized') || lowerMsg.includes('invalid token')) {
    return 'جلستك انتهت، يا ريت تسجل دخول تاني.';
  }
  if (lowerMsg.includes('password') && lowerMsg.includes('incorrect')) {
    return 'الباسورد غلط.';
  }
  if (lowerMsg.includes('password')) {
    return 'الباسورد مش مطابق للشروط.';
  }
  if (lowerMsg.includes('user not found') || lowerMsg.includes('invalid credentials')) {
    return 'بيانات الدخول مش صحيحة.';
  }
  if (lowerMsg.includes('email already exists') || lowerMsg.includes('username already exists') || lowerMsg.includes('already taken') || lowerMsg.includes('duplicate')) {
    return 'الإيميل ده أو اسم المستخدم مسجل قبل كده.';
  }

  // Check if it's already Arabic
  const hasArabic = /[\u0600-\u06FF]/.test(backendMsg);
  if (hasArabic) {
    return backendMsg;
  }

  return `سبب المشكلة: ${backendMsg}`;
};
