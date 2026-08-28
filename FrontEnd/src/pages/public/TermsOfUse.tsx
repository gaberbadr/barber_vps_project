import { useEffect } from 'react';
import './LegalPages.css';

export default function TermsOfUse() {
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <h1 className="legal-title">شروط استخدام البيانات</h1>
          <p className="legal-subtitle">Terms of Data Use</p>
          <p className="legal-last-updated">آخر تحديث: أغسطس 2026</p>
        </div>

        <hr className="legal-divider" />

        {/* Content */}
        <div className="legal-body">
          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">01</span>
              الموافقة على الشروط
            </h2>
            <p className="legal-section-text">
              باستخدامك لموقع وخدمات MR. X BARBER، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام خدماتنا.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">02</span>
              استخدام الخدمة
            </h2>
            <div className="legal-section-text">
              <p>عند استخدامك لخدماتنا، أنت توافق على:</p>
              <ul>
                <li>تقديم معلومات صحيحة ودقيقة عند التسجيل والحجز</li>
                <li>الحفاظ على سرية بيانات حسابك وعدم مشاركتها</li>
                <li>عدم استخدام الخدمة لأي أغراض غير قانونية</li>
                <li>احترام مواعيد الحجز والالتزام بها</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">03</span>
              إدارة الحجوزات
            </h2>
            <div className="legal-section-text">
              <p>فيما يخص نظام الحجز:</p>
              <ul>
                <li>يمكنك حجز مواعيد مع الحلاقين المتاحين عبر المنصة</li>
                <li>يمكنك إلغاء أو تعديل حجزك قبل الموعد بوقت كافٍ</li>
                <li>نحتفظ بالحق في إلغاء الحجوزات في حالة عدم الالتزام بالشروط</li>
                <li>الأسعار المعروضة قابلة للتغيير دون إشعار مسبق</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">04</span>
              معالجة البيانات
            </h2>
            <p className="legal-section-text">
              نقوم بمعالجة بياناتك وفقاً لسياسة الخصوصية الخاصة بنا. تُستخدم بياناتك حصرياً لتقديم وتحسين خدماتنا. لن يتم استخدام بياناتك لأي أغراض تسويقية لطرف ثالث دون موافقتك الصريحة.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">05</span>
              الملكية الفكرية
            </h2>
            <p className="legal-section-text">
              جميع المحتويات المعروضة على الموقع، بما في ذلك التصميمات والشعارات والنصوص والصور، هي ملكية حصرية لـ MR. X BARBER ومحمية بموجب قوانين الملكية الفكرية. لا يجوز نسخ أو إعادة إنتاج أي محتوى دون إذن كتابي مسبق.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">06</span>
              حدود المسؤولية
            </h2>
            <p className="legal-section-text">
              نسعى لتقديم أفضل خدمة ممكنة، لكننا لا نتحمل المسؤولية عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام الموقع أو عدم توفر الخدمة مؤقتاً. نحتفظ بالحق في تعديل أو إيقاف أي جزء من الخدمة في أي وقت.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">07</span>
              التعديلات على الشروط
            </h2>
            <p className="legal-section-text">
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم نشر أي تغييرات على هذه الصفحة مع تحديث تاريخ آخر تعديل. استمرارك في استخدام الخدمة بعد التعديل يعني موافقتك على الشروط المحدثة.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-section-title">
              <span className="legal-section-number">08</span>
              القانون المعمول به
            </h2>
            <p className="legal-section-text">
              تخضع هذه الشروط وتُفسر وفقاً لقوانين جمهورية مصر العربية. أي نزاعات تنشأ عن أو تتعلق بهذه الشروط يتم حلها عن طريق المحاكم المختصة.
            </p>
          </div>

          {/* Contact */}
          <div className="legal-footer-contact">
            <p>
              لو عندك أي أسئلة عن شروط الاستخدام، تواصل معانا على:
              <br />
              <a href="tel:01022149090" dir="ltr">010 2214 9090</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
