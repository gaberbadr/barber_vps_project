import { useEffect } from 'react';
import './LegalPages.css';

export default function PrivacyPolicy() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'google-site-verification';
    meta.content = 'uR-ZMdQQbDtHJT5b8E7htcsBCeECmZMNfrGoBP6wRHU';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="legal-page">
      {/* Background */}
      <div className="legal-bg">
        <img
          src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1920&q=80"
          alt="Barbershop"
          className="legal-bg-img"
        />
        <div className="legal-bg-overlay"></div>
      </div>

      <div className="legal-container">
        {/* Header */}
        <div className="legal-header">
          <svg className="legal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <h1 className="legal-title">سياسة الخصوصية</h1>
          <p className="legal-subtitle">Privacy Policy</p>
          <p className="legal-last-updated">آخر تحديث: أغسطس 2026</p>
        </div>

        <hr className="legal-divider" />

        {/* Content */}
        <div className="legal-body">
          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">01</span>
              مقدمة
            </h2>
            <p className="legal-section-text">
              نحن في MR. X BARBER نقدر خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية المعلومات التي تقدمها لنا عند استخدام موقعنا الإلكتروني وخدماتنا.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">02</span>
              البيانات التي نجمعها
            </h2>
            <div className="legal-section-text">
              <p>نقوم بجمع أنواع محددة من البيانات لتقديم خدماتنا بشكل أفضل:</p>
              <ul>
                <li>الاسم الكامل ورقم الهاتف</li>
                <li>عنوان البريد الإلكتروني</li>
                <li>بيانات الحجز والمواعيد</li>
                <li>تفضيلات الخدمات المختارة</li>
                <li>بيانات الدخول عبر حسابات التواصل الاجتماعي (إن وجدت)</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">03</span>
              كيف نستخدم بياناتك
            </h2>
            <div className="legal-section-text">
              <p>نستخدم بياناتك للأغراض التالية:</p>
              <ul>
                <li>إدارة حجوزاتك ومواعيدك مع الحلاقين</li>
                <li>التواصل معك بخصوص حجوزاتك وتأكيداتها</li>
                <li>تحسين خدماتنا وتجربة المستخدم</li>
                <li>إرسال عروض وتحديثات (بموافقتك)</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">04</span>
              حماية البيانات
            </h2>
            <p className="legal-section-text">
              نتخذ إجراءات أمنية مناسبة لحماية بياناتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفشاء أو الإتلاف. نستخدم تقنيات تشفير حديثة ونحتفظ بالبيانات في خوادم آمنة.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">05</span>
              مشاركة البيانات
            </h2>
            <p className="legal-section-text">
              لا نقوم ببيع أو تأجير بياناتك الشخصية لأي طرف ثالث. قد نشارك بياناتك فقط مع الحلاقين المعنيين بحجزك لتقديم الخدمة المطلوبة، أو عند الاقتضاء بموجب القانون.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">06</span>
              حقوقك
            </h2>
            <div className="legal-section-text">
              <p>لديك الحق في:</p>
              <ul>
                <li>الاطلاع على بياناتك الشخصية المحفوظة لدينا</li>
                <li>طلب تصحيح أو تحديث بياناتك</li>
                <li>طلب حذف بياناتك من أنظمتنا</li>
                <li>الانسحاب من تلقي الرسائل التسويقية في أي وقت</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">07</span>
              ملفات تعريف الارتباط (Cookies)
            </h2>
            <p className="legal-section-text">
              نستخدم ملفات تعريف الارتباط لتحسين تجربتك على الموقع وتذكر تفضيلاتك. يمكنك التحكم في إعدادات ملفات تعريف الارتباط من خلال متصفحك.
            </p>
          </div>

          {/* Contact */}
          <div className="legal-footer-contact">
            <p>
              لو عندك أي أسئلة عن سياسة الخصوصية، تواصل معانا على:
              <br />
              <a href="tel:01022149090" dir="ltr">010 2214 9090</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
