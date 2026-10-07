/**
 * RETHA Admin Panel — Native i18n & Localization Engine
 * Provides seamless bilingual support (AR / EN) with RTL / LTR layout switching.
 * Retains exact established legal and real estate terminology.
 */

const STORAGE_KEY = 'retha_admin_lang';

export const adminTranslations = {
  en: {
    // Brand & Topbar
    'brand_name': 'RETHA ADMIN',
    'brand_sub': 'Authority Control Center',
    'admin_crumb': 'Admin',
    'crumb_properties': 'Properties',
    'crumb_new_prop': 'New Property',
    'crumb_edit_prop': 'Edit Property',
    'crumb_leads': 'Leads & Inquiries',
    'crumb_telegram': 'Telegram Team',
    'live_site': 'Live Site ↗',
    'sign_out': 'Sign Out',
    'auth_admin': 'Authenticated Admin',

    // Sidebar Navigation
    'nav_management': 'Management',
    'nav_properties': 'Properties Portfolio',
    'nav_add_property': 'Add New Property',
    'nav_leads': 'Client Inquiries & Leads',
    'nav_telegram': 'Telegram Team',
    'nav_external': 'External',
    'nav_view_live': 'View Live Website',
    'nav_rega_portal': 'REGA Official Portal',

    // Properties View
    'prop_title': 'Properties Portfolio',
    'prop_desc': 'Manage verified luxury assets, pricing, availability status, and architectural details.',
    'btn_add_property': '+ Add New Property',
    'stat_total_props': 'Total Verified Assets',
    'stat_available_props': 'Available (متاح)',
    'stat_reserved_props': 'Reserved (محجوز)',
    'stat_sold_props': 'Sold (تم البيع)',
    'search_props_placeholder': 'Search by title, ref code, city, neighborhood...',
    'filter_status_label': 'Status:',
    'filter_all_statuses': 'All Statuses',
    'filter_type_label': 'Type:',
    'filter_all_types': 'All Types',
    'filter_type_villa': 'Villa',
    'filter_type_apartment': 'Apartment',
    'filter_type_office': 'Office',
    'filter_type_land': 'Land',

    // Table Headers
    'th_property': 'Property',
    'th_ref_code': 'Reference Code',
    'th_location': 'Location',
    'th_price': 'Price',
    'th_type_area': 'Type / Area',
    'th_status': 'Status',
    'th_images': 'Images',
    'th_created': 'Created',
    'th_actions': 'Actions',

    // Leads View
    'leads_title': 'Client Inquiries & Acquisition Leads',
    'leads_desc': 'Review VIP private acquisition advisory requests, customer contacts, and update acquisition pipeline status.',
    'stat_total_leads': 'Total Inquiries',
    'stat_new_leads': 'New Pipeline',
    'stat_contacted_leads': 'Contacted',
    'stat_closed_leads': 'Closed Acquisitions',
    'search_leads_placeholder': 'Search by client name, phone, email, notes...',
    'filter_pipeline_label': 'Pipeline Status:',
    'filter_target_prop_label': 'Target Property:',
    'filter_all_props': 'All Properties',
    'th_client_name': 'Client Name',
    'th_phone_outreach': 'Phone / Outreach',
    'th_email': 'Email',
    'th_target_asset': 'Target Asset',
    'th_budget_method': 'Budget / Method',
    'th_pipeline_status': 'Pipeline Status (Live)',
    'th_message': 'Message',
    'th_date_received': 'Date Received',

    // Status Values
    'status_new': 'New (جديد)',
    'status_pending': 'Reserved (تم الحجز)',
    'status_contacted': 'Contacted (تم التواصل)',
    'status_sold': 'Sold (تم البيع)',
    'status_closed': 'Closed (مغلق)',
    'status_available': 'Available (متاح)',
    'status_reserved': 'Reserved (تم الحجز)',

    // Common
    'loading': 'Loading...',
    'reset_filters': 'Reset Filters',
    'save_changes': 'Save Changes',
    'delete': 'Delete',
    'cancel': 'Cancel'
  },
  ar: {
    // Brand & Topbar
    'brand_name': 'إدارة ريثا',
    'brand_sub': 'لوحة القيادة والتحكم',
    'admin_crumb': 'لوحة القيادة',
    'crumb_properties': 'المحفظة العقارية',
    'crumb_new_prop': 'إضافة عقار',
    'crumb_edit_prop': 'تعديل العقار',
    'crumb_leads': 'الطلبات والاستفسارات',
    'crumb_telegram': 'فريق التيليجرام',
    'live_site': 'الموقع المباشر ↗',
    'sign_out': 'تسجيل الخروج',
    'auth_admin': 'مدير معتمد',

    // Sidebar Navigation
    'nav_management': 'إدارة النظام',
    'nav_properties': 'المحفظة العقارية',
    'nav_add_property': 'إضافة عقار جديد',
    'nav_leads': 'طلبات واستفسارات العملاء',
    'nav_telegram': 'فريق التيليجرام',
    'nav_external': 'روابط خارجية',
    'nav_view_live': 'عرض الموقع المباشر',
    'nav_rega_portal': 'بوابة الهيئة العامة للعقار',

    // Properties View
    'prop_title': 'المحفظة العقارية المعتمدة',
    'prop_desc': 'إدارة الأصول العقارية الفاخرة، والأسعار، وحالات التوفر، والتفاصيل المعمارية.',
    'btn_add_property': '+ إضافة عقار جديد',
    'stat_total_props': 'إجمالي الأصول الموثقة',
    'stat_available_props': 'متاح (Available)',
    'stat_reserved_props': 'محجوز (Reserved)',
    'stat_sold_props': 'تم البيع (Sold)',
    'search_props_placeholder': 'ابحث بالعنوان، الكود المرجعي، المدينة، الحي...',
    'filter_status_label': 'الحالة:',
    'filter_all_statuses': 'جميع الحالات',
    'filter_type_label': 'النوع:',
    'filter_all_types': 'كافة الأنواع',
    'filter_type_villa': 'فيلا / قصر',
    'filter_type_apartment': 'بنتهاوس / شقة',
    'filter_type_office': 'مكتبي / تجاري',
    'filter_type_land': 'أرض استثمارية',

    // Table Headers
    'th_property': 'العقار',
    'th_ref_code': 'الكود المرجعي',
    'th_location': 'الموقع',
    'th_price': 'السعر',
    'th_type_area': 'النوع / المساحة',
    'th_status': 'الحالة',
    'th_images': 'الصور',
    'th_created': 'تاريخ الإضافة',
    'th_actions': 'الإجراءات',

    // Leads View
    'leads_title': 'طلبات واستفسارات الاستحواذ العقاري',
    'leads_desc': 'مراجعة طلبات الاستشارة الخاصة لكبار الشخصيات والتواصل مع العملاء ومتابعة مسار الصفقات.',
    'stat_total_leads': 'إجمالي الاستفسارات',
    'stat_new_leads': 'طلبات جديدة',
    'stat_contacted_leads': 'تم التواصل',
    'stat_closed_leads': 'صفقات منجزة',
    'search_leads_placeholder': 'ابحث باسم العميل، الهاتف، البريد، الملاحظات...',
    'filter_pipeline_label': 'حالة الطلب:',
    'filter_target_prop_label': 'العقار المستهدف:',
    'filter_all_props': 'كافة العقارات',
    'th_client_name': 'اسم العميل',
    'th_phone_outreach': 'الهاتف / التواصل',
    'th_email': 'البريد الإلكتروني',
    'th_target_asset': 'العقار المطلوب',
    'th_budget_method': 'الميزانية / الوسيلة',
    'th_pipeline_status': 'حالة الطلب (مباشر)',
    'th_message': 'الرسالة / الملاحظات',
    'th_date_received': 'تاريخ الاستلام',

    // Status Values
    'status_new': 'جديد (New)',
    'status_pending': 'تم الحجز (Reserved)',
    'status_contacted': 'تم التواصل (Contacted)',
    'status_sold': 'تم البيع (Sold)',
    'status_closed': 'مغلق (Closed)',
    'status_available': 'متاح (Available)',
    'status_reserved': 'تم الحجز (Reserved)',

    // Common
    'loading': 'جاري التحميل...',
    'reset_filters': 'إعادة ضبط التصفية',
    'save_changes': 'حفظ التغييرات',
    'delete': 'حذف',
    'cancel': 'إلغاء'
  }
};

let currentLang = 'en';

export function getAdminLanguage() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') {
      currentLang = saved;
    }
  }
  return currentLang;
}

export function setAdminLanguage(lang) {
  if (lang !== 'ar' && lang !== 'en') return;
  currentLang = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    window.dispatchEvent(new CustomEvent('retha:admin-lang-changed', { detail: { lang } }));
  }
}

export function toggleAdminLanguage() {
  const nextLang = getAdminLanguage() === 'ar' ? 'en' : 'ar';
  setAdminLanguage(nextLang);
  return nextLang;
}

export function tAdmin(key, fallback = '') {
  const lang = getAdminLanguage();
  return adminTranslations[lang]?.[key] || adminTranslations['en']?.[key] || fallback || key;
}

/**
 * Initializes language on Admin App load
 */
export function initAdminI18n() {
  const lang = getAdminLanguage();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  return lang;
}
