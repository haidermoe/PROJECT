# 📊 فلو جارت شامل للمشروع

## 🎯 نظرة عامة على النظام

```
┌─────────────────────────────────────────────────────────────┐
│                    نظام إدارة المطعم                         │
│              Restaurant Management System                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ تدفق المصادقة (Authentication Flow)

```mermaid
flowchart TD
    Start([المستخدم يفتح التطبيق]) --> CheckToken{هل يوجد توكن في localStorage?}
    
    CheckToken -->|لا| LoginPage[صفحة تسجيل الدخول<br/>index.html]
    CheckToken -->|نعم| VerifyToken[التحقق من صحة التوكن<br/>auth-check.js]
    
    LoginPage --> EnterCredentials[إدخال اسم المستخدم وكلمة المرور]
    EnterCredentials --> ValidateInput[التحقق من صحة البيانات<br/>validateLogin middleware]
    
    ValidateInput -->|غير صحيح| ShowError[عرض رسالة خطأ]
    ShowError --> LoginPage
    
    ValidateInput -->|صحيح| SendLogin[إرسال POST /auth/login]
    SendLogin --> CheckUser{البحث في auth_db.users}
    
    CheckUser -->|المستخدم غير موجود| ReturnError[إرجاع خطأ 401]
    ReturnError --> ShowError
    
    CheckUser -->|المستخدم موجود| CheckPassword[التحقق من كلمة المرور<br/>bcrypt.compare]
    
    CheckPassword -->|كلمة المرور خاطئة| ReturnError
    CheckPassword -->|كلمة المرور صحيحة| CheckActive{هل المستخدم نشط?<br/>is_active = 1}
    
    CheckActive -->|غير نشط| ReturnError
    CheckActive -->|نشط| GenerateToken[إنشاء JWT Token<br/>يحتوي: id, username, role]
    
    GenerateToken --> SaveToken[حفظ التوكن في localStorage<br/>localStorage.setItem 'token']
    SaveToken --> SaveUser[حفظ بيانات المستخدم في localStorage<br/>localStorage.setItem 'user']
    
    SaveUser --> Redirect[إعادة التوجيه حسب الرتبة]
    
    VerifyToken --> CallAPI[استدعاء GET /auth/me]
    CallAPI --> CheckResponse{هل التوكن صالح?}
    
    CheckResponse -->|غير صالح| ClearStorage[مسح localStorage]
    ClearStorage --> LoginPage
    
    CheckResponse -->|صالح| CheckPermissions[التحقق من الصلاحيات<br/>auth-check.js]
    
    CheckPermissions --> Redirect
    
    Redirect --> AdminDash{هل المدير العام?}
    Redirect --> ManagerDash{هل مدير?}
    Redirect --> KitchenEmp{هل موظف مطبخ?}
    Redirect --> RegularEmp{هل موظف عادي?}
    
    AdminDash -->|نعم| Dashboard[لوحة التحكم<br/>dashboard/dashboard.html]
    ManagerDash -->|نعم| Dashboard
    KitchenEmp -->|نعم| Inventory[صفحة المخزن<br/>inventory.html]
    RegularEmp -->|نعم| Attendance[صفحة البصمة<br/>attendance.html]
    
    Dashboard --> End([تم تسجيل الدخول])
    Inventory --> End
    Attendance --> End
```

---

## 2️⃣ تدفق التفويض والصلاحيات (Authorization Flow)

```mermaid
flowchart TD
    UserAccess([المستخدم يحاول الوصول لصفحة]) --> LoadAuthCheck[تحميل auth-check.js]
    
    LoadAuthCheck --> HidePage["إخفاء الصفحة مؤقتاً (display: none)"]
    HidePage --> GetToken[جلب التوكن من localStorage]
    
    GetToken --> TokenExists{هل يوجد توكن?}
    
    TokenExists -->|لا| RedirectLogin["إعادة التوجيه لتسجيل الدخول (window.location.replace)"]
    
    TokenExists -->|نعم| VerifyWithServer["التحقق من التوكن مع السيرفر (GET /auth/me)"]
    
    VerifyWithServer --> TokenValid{هل التوكن صالح?}
    
    TokenValid -->|لا| ClearStorage[مسح localStorage]
    ClearStorage --> RedirectLogin
    
    TokenValid -->|نعم| GetUserRole["جلب رتبة المستخدم (user.role)"]
    
    GetUserRole --> CheckPageAccess{فحص الصفحة المطلوبة}
    
    CheckPageAccess --> AdminPage{"صفحة إدارة? (employees.html, dashboard.html)"}
    CheckPageAccess --> InventoryPage{"صفحة مخزن? (inventory.html, withdrawals.html)"}
    CheckPageAccess --> NotificationsPage{"صفحة إشعارات? (notifications.html)"}
    CheckPageAccess --> RegularPage{"صفحة عادية? (attendance.html, leaves.html)"}
    
    AdminPage --> IsAdmin{هل admin?}
    IsAdmin -->|نعم| AllowAccess[السماح بالوصول]
    IsAdmin -->|لا| RedirectToAllowed[إعادة التوجيه لصفحة مسموحة]
    
    InventoryPage --> IsKitchenEmp{"هل kitchen_employee أو kitchen_manager أو admin?"}
    IsKitchenEmp -->|نعم| AllowAccess
    IsKitchenEmp -->|لا| RedirectToAllowed
    
    NotificationsPage --> IsAdmin2{هل admin?}
    IsAdmin2 -->|نعم| AllowAccess
    IsAdmin2 -->|لا| RedirectToAllowed
    
    RegularPage --> AllowAccess
    
    RedirectToAllowed --> RegularEmpCheck{هل موظف عادي?}
    RegularEmpCheck -->|نعم| RedirectAttendance["إعادة التوجيه لـ attendance.html"]
    RegularEmpCheck -->|لا| RedirectInventory["إعادة التوجيه لـ inventory.html"]
    
    AllowAccess --> LoadPermissions["تحميل permissions.js"]
    LoadPermissions --> ApplyPermissions["تطبيق الصلاحيات (applyPermissions())"]
    
    ApplyPermissions --> HideRestricted["إخفاء العناصر المقيدة (sidebar.js)"]
    HideRestricted --> ShowPage["إظهار الصفحة (display: '')"]
    
    ShowPage --> End([تم الوصول للصفحة])
    RedirectLogin --> End
    RedirectAttendance --> End
    RedirectInventory --> End
```

---

## 3️⃣ تدفق إدارة الموظفين (Employee Management Flow)

```mermaid
flowchart TD
    Start([المدير العام يفتح صفحة الموظفين]) --> CheckAuth{"التحقق من الصلاحيات (isAdmin())"}
    
    CheckAuth -->|غير مصرح| Redirect[إعادة التوجيه]
    CheckAuth -->|مصرح| LoadEmployees["تحميل قائمة الموظفين (GET /auth/users)"]
    
    LoadEmployees --> DisplayTable["عرض الجدول (employees.js)"]
    
    DisplayTable --> UserAction{إجراء المستخدم}
    
    UserAction -->|إضافة موظف| ShowAddModal[فتح نافذة إضافة موظف]
    UserAction -->|تعديل موظف| ShowEditModal[فتح نافذة تعديل موظف]
    UserAction -->|تعطيل/تفعيل| ToggleUser[تبديل حالة المستخدم]
    UserAction -->|حذف موظف| ConfirmDelete[طلب تأكيد الحذف]
    
    ShowAddModal --> FillForm["ملء النموذج: username, password, role, full_name"]
    FillForm --> ValidateForm{"التحقق من البيانات (validateCreateUser)"}
    
    ValidateForm -->|غير صحيح| ShowError[عرض رسالة خطأ]
    ValidateForm -->|صحيح| SendCreate["إرسال POST /auth/users"]
    
    SendCreate --> HashPassword["تشفير كلمة المرور (bcrypt.hash)"]
    HashPassword --> InsertDB[إدراج في auth_db.users]
    
    InsertDB --> Success[نجاح - تحديث الجدول]
    
    ShowEditModal --> LoadUserData[تحميل بيانات المستخدم]
    LoadUserData --> FillEditForm[ملء النموذج بالبيانات الحالية]
    FillEditForm --> ModifyData[تعديل البيانات]
    ModifyData --> ValidateEdit{التحقق من البيانات}
    
    ValidateEdit -->|غير صحيح| ShowError
    ValidateEdit -->|صحيح| SendUpdate[إرسال PUT /auth/users/:id]
    
    SendUpdate --> UpdateDB[تحديث auth_db.users]
    UpdateDB --> Success
    
    ToggleUser --> SendToggle[إرسال PUT /auth/users/:id/toggle]
    SendToggle --> UpdateStatus[تحديث is_active في auth_db.users]
    UpdateStatus --> Success
    
    ConfirmDelete --> UserConfirm{تأكيد المستخدم}
    UserConfirm -->|إلغاء| DisplayTable
    UserConfirm -->|تأكيد| SendDelete[إرسال DELETE /auth/users/:id]
    
    SendDelete --> DeleteDB[حذف من auth_db.users]
    DeleteDB --> Success
    
    Success --> RefreshTable[تحديث الجدول]
    RefreshTable --> DisplayTable
    ShowError --> DisplayTable
```

---

## 4️⃣ تدفق طلبات الإجازات (Leave Requests Flow)

```mermaid
flowchart TD
    Start([الموظف يفتح صفحة الإجازات]) --> CheckAuth[التحقق من التوكن]
    
    CheckAuth --> LoadLeaves[تحميل طلبات الإجازات<br/>GET /api/leaves/my-leaves]
    
    LoadLeaves --> DisplayLeaves[عرض الطلبات في الجدول]
    
    DisplayLeaves --> UserAction{إجراء المستخدم}
    
    UserAction -->|طلب إجازة جديدة| ShowRequestForm[فتح نموذج طلب إجازة]
    UserAction -->|فلترة| ApplyFilter[تطبيق الفلتر<br/>status, leave_type]
    UserAction -->|إلغاء طلب| CancelRequest[إلغاء طلب قيد الانتظار]
    
    ShowRequestForm --> FillForm[ملء النموذج:<br/>leave_type, start_date, end_date, reason]
    FillForm --> ValidateDates{التحقق من التواريخ}
    
    ValidateDates -->|غير صحيح| ShowError[عرض رسالة خطأ]
    ValidateDates -->|صحيح| CalculateDays[حساب عدد الأيام]
    
    CalculateDays --> SendRequest[إرسال POST /api/leaves/request]
    
    SendRequest --> InsertLeave[إدراج في app_db.leave_requests<br/>status = 'pending']
    
    InsertLeave --> CreateNotification[إنشاء إشعار للمدير العام<br/>createNotification]
    
    CreateNotification --> QueryAdmins[البحث عن جميع المديرين<br/>SELECT * FROM users WHERE role = 'admin']
    
    QueryAdmins --> LoopAdmins[حلقة على كل مدير]
    LoopAdmins --> InsertNotif[إدراج في app_db.notifications<br/>type = 'leave_request']
    
    InsertNotif --> Success[نجاح - تحديث الجدول]
    
    ApplyFilter --> BuildQuery[بناء استعلام SQL<br/>WHERE status = ? AND leave_type = ?]
    BuildQuery --> FilterResults[تصفية النتائج]
    FilterResults --> DisplayLeaves
    
    CancelRequest --> CheckStatus{هل status = 'pending'?}
    
    CheckStatus -->|لا| ShowError2[لا يمكن إلغاء طلب موافق عليه]
    CheckStatus -->|نعم| SendCancel[إرسال PUT /api/leaves/:id/cancel]
    
    SendCancel --> UpdateStatus[تحديث status = 'cancelled'<br/>في app_db.leave_requests]
    
    UpdateStatus --> CreateCancelNotif[إنشاء إشعار إلغاء للمدير]
    CreateCancelNotif --> Success
    
    Success --> RefreshLeaves[تحديث قائمة الإجازات]
    RefreshLeaves --> DisplayLeaves
    
    ShowError --> DisplayLeaves
    ShowError2 --> DisplayLeaves
    
    DisplayLeaves --> AdminView{هل المدير العام?}
    
    AdminView -->|نعم| LoadAllLeaves[تحميل جميع الطلبات<br/>GET /api/leaves/all-leaves]
    AdminView -->|لا| End([انتهى])
    
    LoadAllLeaves --> DisplayAllLeaves[عرض جميع الطلبات]
    
    DisplayAllLeaves --> AdminAction{إجراء المدير}
    
    AdminAction -->|الموافقة| ApproveLeave[إرسال PUT /api/leaves/:id/approve]
    AdminAction -->|الرفض| RejectLeave[إرسال PUT /api/leaves/:id/reject]
    
    ApproveLeave --> UpdateApproved[تحديث status = 'approved']
    RejectLeave --> UpdateRejected[تحديث status = 'rejected']
    
    UpdateApproved --> Success
    UpdateRejected --> Success
```

---

## 5️⃣ تدفق إدارة المخزن (Inventory Management Flow)

```mermaid
flowchart TD
    Start([المستخدم يفتح صفحة المخزن]) --> CheckAuth[التحقق من التوكن]
    
    CheckAuth --> CheckRole{فحص الرتبة}
    
    CheckRole -->|admin/kitchen_manager| FullAccess[صلاحيات كاملة]
    CheckRole -->|kitchen_employee| WithdrawOnly[صلاحية سحب فقط]
    CheckRole -->|موظف عادي| Redirect[إعادة التوجيه]
    
    FullAccess --> LoadInventory[تحميل المخزن<br/>GET /api/inventory]
    WithdrawOnly --> LoadInventory
    
    LoadInventory --> DisplayItems[عرض المواد في الجدول]
    
    DisplayItems --> UserAction{إجراء المستخدم}
    
    UserAction -->|إضافة مادة| ShowAddForm[فتح نموذج إضافة]
    UserAction -->|تعديل مادة| ShowEditForm[فتح نموذج تعديل]
    UserAction -->|سحب مادة| ShowWithdrawForm[فتح نموذج سحب]
    UserAction -->|إيداع مادة| ShowDepositForm[فتح نموذج إيداع]
    
    ShowAddForm --> FillAddForm[ملء النموذج:<br/>name, category, unit, initial_quantity]
    FillAddForm --> ValidateAdd{التحقق من البيانات}
    
    ValidateAdd -->|غير صحيح| ShowError[عرض رسالة خطأ]
    ValidateAdd -->|صحيح| SendAdd[إرسال POST /api/inventory]
    
    SendAdd --> InsertItem[إدراج في app_db.inventory_items]
    InsertItem --> Success[نجاح - تحديث الجدول]
    
    ShowEditForm --> LoadItemData[تحميل بيانات المادة]
    LoadItemData --> FillEditForm[ملء النموذج]
    FillEditForm --> ModifyData[تعديل البيانات]
    ModifyData --> ValidateEdit{التحقق}
    
    ValidateEdit -->|غير صحيح| ShowError
    ValidateEdit -->|صحيح| SendUpdate[إرسال PUT /api/inventory/:id]
    
    SendUpdate --> UpdateItem[تحديث app_db.inventory_items]
    UpdateItem --> Success
    
    ShowWithdrawForm --> FillWithdrawForm[ملء النموذج:<br/>item_id, quantity, reason]
    FillWithdrawForm --> CheckQuantity{هل الكمية متوفرة?}
    
    CheckQuantity -->|لا| ShowError2[الكمية غير كافية]
    CheckQuantity -->|نعم| SendWithdraw[إرسال POST /api/withdrawals]
    
    SendWithdraw --> InsertWithdrawal[إدراج في app_db.withdrawals<br/>type = 'withdrawal']
    
    InsertWithdrawal --> UpdateInventory[تحديث quantity في app_db.inventory_items<br/>quantity = quantity - withdrawn]
    
    UpdateInventory --> Success
    
    ShowDepositForm --> FillDepositForm[ملء النموذج:<br/>item_id, quantity]
    FillDepositForm --> SendDeposit[إرسال POST /api/withdrawals<br/>type = 'deposit']
    
    SendDeposit --> InsertDeposit[إدراج في app_db.withdrawals<br/>type = 'deposit']
    
    InsertDeposit --> UpdateInventory2[تحديث quantity في app_db.inventory_items<br/>quantity = quantity + deposited]
    
    UpdateInventory2 --> Success
    
    Success --> RefreshInventory[تحديث قائمة المخزن]
    RefreshInventory --> DisplayItems
    
    ShowError --> DisplayItems
    ShowError2 --> DisplayItems
```

---

## 6️⃣ تدفق إدارة الهدر (Waste Management Flow)

```mermaid
flowchart TD
    Start([مدير المطبخ يفتح صفحة الهدر]) --> CheckAuth[التحقق من التوكن]
    
    CheckAuth --> CheckRole{هل kitchen_manager أو admin?}
    
    CheckRole -->|لا| Redirect[إعادة التوجيه - لا صلاحية]
    CheckRole -->|نعم| LoadWaste[تحميل سجلات الهدر<br/>GET /api/waste]
    
    LoadWaste --> DisplayWaste[عرض السجلات في الجدول]
    
    DisplayWaste --> UserAction{إجراء المستخدم}
    
    UserAction -->|تسجيل هدر جديد| ShowAddForm[فتح نموذج تسجيل هدر]
    UserAction -->|إلغاء طلب| CancelWaste[إلغاء طلب قيد الانتظار]
    UserAction -->|فلترة| ApplyFilter[تطبيق الفلتر]
    
    ShowAddForm --> FillForm[ملء النموذج:<br/>item_name, quantity, unit,<br/>waste_type, reason, waste_date]
    
    FillForm --> ValidateForm{التحقق من البيانات}
    
    ValidateForm -->|غير صحيح| ShowError[عرض رسالة خطأ]
    ValidateForm -->|صحيح| SendAdd[إرسال POST /api/waste]
    
    SendAdd --> InsertWaste[إدراج في app_db.waste_records<br/>status = 'pending']
    
    InsertWaste --> CreateNotification[إنشاء إشعار للمدير العام<br/>createNotification]
    
    CreateNotification --> QueryAdmins[البحث عن جميع المديرين<br/>SELECT * FROM users WHERE role = 'admin']
    
    QueryAdmins --> LoopAdmins[حلقة على كل مدير]
    LoopAdmins --> InsertNotif[إدراج في app_db.notifications<br/>type = 'waste_submission']
    
    InsertNotif --> Success[نجاح - تحديث الجدول]
    
    CancelWaste --> CheckStatus{هل status = 'pending'?}
    
    CheckStatus -->|لا| ShowError2[لا يمكن إلغاء طلب موافق عليه]
    CheckStatus -->|نعم| SendCancel[إرسال PUT /api/waste/:id/cancel]
    
    SendCancel --> UpdateStatus[تحديث status = 'cancelled'<br/>في app_db.waste_records]
    
    UpdateStatus --> CreateCancelNotif[إنشاء إشعار إلغاء للمدير]
    CreateCancelNotif --> Success
    
    ApplyFilter --> BuildQuery[بناء استعلام SQL]
    BuildQuery --> FilterResults[تصفية النتائج]
    FilterResults --> DisplayWaste
    
    DisplayWaste --> AdminView{هل المدير العام?}
    
    AdminView -->|نعم| ShowApproveBtn[عرض أزرار الموافقة/الرفض]
    AdminView -->|لا| End([انتهى])
    
    ShowApproveBtn --> AdminAction{إجراء المدير}
    
    AdminAction -->|الموافقة| ApproveWaste[إرسال PUT /api/waste/:id/approve]
    AdminAction -->|الرفض| RejectWaste[إرسال PUT /api/waste/:id/reject]
    
    ApproveWaste --> UpdateApproved[تحديث status = 'approved']
    ApproveWaste --> UpdateInventory[تحديث المخزن<br/>quantity = quantity - wasted]
    
    UpdateApproved --> Success
    UpdateInventory --> Success
    
    RejectWaste --> UpdateRejected[تحديث status = 'rejected']
    UpdateRejected --> Success
    
    Success --> RefreshWaste[تحديث قائمة الهدر]
    RefreshWaste --> DisplayWaste
    
    ShowError --> DisplayWaste
    ShowError2 --> DisplayWaste
```

---

## 7️⃣ تدفق الإشعارات (Notifications Flow)

```mermaid
flowchart TD
    Start([المدير العام يفتح التطبيق]) --> CheckAuth[التحقق من التوكن]
    
    CheckAuth --> CheckAdmin{هل admin?}
    
    CheckAdmin -->|لا| HideNotifications[إخفاء قسم الإشعارات]
    CheckAdmin -->|نعم| LoadNotifications[تحميل الإشعارات<br/>GET /api/notifications]
    
    LoadNotifications --> QueryDB[استعلام app_db.notifications<br/>WHERE user_id = ?<br/>ORDER BY created_at DESC]
    
    QueryDB --> GetUnreadCount[حساب عدد غير المقروءة<br/>WHERE is_read = 0]
    
    GetUnreadCount --> DisplayNotifications[عرض الإشعارات في Dashboard]
    
    DisplayNotifications --> ShowBadge[عرض شارة العدد<br/>notification-badge]
    
    ShowBadge --> UserAction{إجراء المستخدم}
    
    UserAction -->|فتح صفحة الإشعارات| LoadAllNotifications[تحميل جميع الإشعارات<br/>GET /api/notifications?limit=100]
    
    UserAction -->|تحديث تلقائي| AutoRefresh[تحديث كل 30 ثانية<br/>setInterval]
    
    UserAction -->|قراءة إشعار| MarkRead[تحديد كمقروء<br/>PUT /api/notifications/:id/read]
    
    UserAction -->|حذف إشعار| DeleteNotif[حذف إشعار<br/>DELETE /api/notifications/:id]
    
    UserAction -->|قراءة الكل| MarkAllRead[تحديد الكل كمقروء<br/>PUT /api/notifications/read-all]
    
    LoadAllNotifications --> DisplayAll[عرض جميع الإشعارات<br/>notifications.html]
    
    MarkRead --> UpdateDB[تحديث is_read = 1<br/>في app_db.notifications]
    
    UpdateDB --> UpdateCount[تحديث العداد]
    UpdateCount --> RefreshDisplay[تحديث العرض]
    
    DeleteNotif --> DeleteFromDB[حذف من app_db.notifications]
    DeleteFromDB --> RefreshDisplay
    
    MarkAllRead --> UpdateAllDB[تحديث جميع is_read = 1<br/>WHERE user_id = ?]
    UpdateAllDB --> UpdateCount
    
    AutoRefresh --> LoadNotifications
    
    RefreshDisplay --> DisplayNotifications
    
    DisplayAll --> FilterOptions{خيارات الفلترة}
    
    FilterOptions -->|غير المقروءة فقط| FilterUnread[GET /api/notifications?unread_only=true]
    FilterOptions -->|الكل| LoadAllNotifications
    
    FilterUnread --> DisplayAll
    
    DisplayAll --> NotifClick{نقر على إشعار}
    
    NotifClick --> CheckType{نوع الإشعار}
    
    CheckType -->|leave_request| RedirectLeaves[إعادة التوجيه لصفحة الإجازات]
    CheckType -->|waste_submission| RedirectWaste[إعادة التوجيه لصفحة الهدر]
    
    RedirectLeaves --> End([انتهى])
    RedirectWaste --> End
    HideNotifications --> End
```

---

## 8️⃣ تدفق إنشاء الإشعارات (Notification Creation Flow)

```mermaid
flowchart TD
    Event([حدث في النظام]) --> CheckEventType{نوع الحدث}
    
    CheckEventType -->|طلب إجازة| LeaveRequest[requestLeave في leavesController.js]
    CheckEventType -->|تسجيل هدر| WasteSubmission[addWaste في wasteController.js]
    CheckEventType -->|إلغاء طلب إجازة| CancelLeave[Cancel Leave Request]
    CheckEventType -->|إلغاء طلب هدر| CancelWaste[Cancel Waste Request]
    
    LeaveRequest --> CreateLeaveNotif[استدعاء createNotification<br/>type: 'leave_request']
    WasteSubmission --> CreateWasteNotif[استدعاء createNotification<br/>type: 'waste_submission']
    CancelLeave --> CreateCancelLeaveNotif[استدعاء createNotification<br/>type: 'leave_cancelled']
    CancelWaste --> CreateCancelWasteNotif[استدعاء createNotification<br/>type: 'waste_cancelled']
    
    CreateLeaveNotif --> QueryAdmins[البحث عن جميع المديرين<br/>SELECT * FROM users<br/>WHERE role = 'admin'<br/>AND is_active = 1]
    
    CreateWasteNotif --> QueryAdmins
    CreateCancelLeaveNotif --> QueryAdmins
    CreateCancelWasteNotif --> QueryAdmins
    
    QueryAdmins --> LoopAdmins[حلقة على كل مدير]
    
    LoopAdmins --> BuildMessage[بناء رسالة الإشعار]
    
    BuildMessage --> InsertNotif[إدراج في app_db.notifications<br/>INSERT INTO notifications<br/>user_id, type, reference_id,<br/>title, message, is_read = 0]
    
    InsertNotif --> Success[نجاح - تم إنشاء الإشعار]
    
    Success --> NotifyFrontend{هل Frontend متصل?}
    
    NotifyFrontend -->|نعم| UpdateBadge[تحديث شارة العدد في Dashboard]
    NotifyFrontend -->|لا| WaitForLoad[انتظار تحميل Dashboard]
    
    UpdateBadge --> End([انتهى])
    WaitForLoad --> UpdateBadge
```

---

## 9️⃣ تدفق الصلاحيات حسب الرتب (Role-Based Permissions Flow)

```mermaid
flowchart TD
    User([المستخدم]) --> GetRole["جلب الرتبة من localStorage (user.role)"]
    
    GetRole --> RoleType{نوع الرتبة}
    
    RoleType -->|admin| AdminPerms[صلاحيات المدير العام]
    RoleType -->|manager| ManagerPerms[صلاحيات المدير]
    RoleType -->|kitchen_manager| KitchenManagerPerms[صلاحيات مدير المطبخ]
    RoleType -->|kitchen_employee| KitchenEmployeePerms[صلاحيات موظف المطبخ]
    RoleType -->|employee/waiter/captain/etc| RegularEmployeePerms[صلاحيات الموظف العادي]
    
    AdminPerms --> AdminAccess["الوصول الكامل: جميع الصفحات، إدارة الموظفين، المخزن، الوصفات، الموافقة، الإشعارات"]
    
    ManagerPerms --> ManagerAccess["الوصول: لوحة التحكم، المخزن، الوصفات، الموافقة | لا: إدارة الموظفين، الإشعارات"]
    
    KitchenManagerPerms --> KitchenManagerAccess["الوصول: المخزن، الوصفات، تسجيل الهدر، البصمة، الإجازات | لا: إدارة الموظفين، الإشعارات"]
    
    KitchenEmployeePerms --> KitchenEmployeeAccess["الوصول: المخزن قراءة، السحوبات سحب فقط، البصمة، الإجازات | لا: إضافة مواد، إدارة الموظفين، الإشعارات"]
    
    RegularEmployeePerms --> RegularEmployeeAccess["الوصول: البصمة، الإجازات | لا: جميع الصفحات الأخرى"]
    
    AdminAccess --> ApplySidebar["تطبيق الصلاحيات على Sidebar (sidebar.js)"]
    ManagerAccess --> ApplySidebar
    KitchenManagerAccess --> ApplySidebar
    KitchenEmployeeAccess --> ApplySidebar
    RegularEmployeeAccess --> ApplySidebar
    
    ApplySidebar --> HideRestricted["إخفاء العناصر المقيدة (menu-item.style.display = 'none')"]
    
    HideRestricted --> ApplyPagePerms["تطبيق الصلاحيات على الصفحة (permissions.js)"]
    
    ApplyPagePerms --> CheckAction{إجراء المستخدم}
    
    CheckAction -->|إضافة/تعديل/حذف| CheckPermission{"التحقق من الصلاحية: canManageUsers(), canManageRecipes(), canAddInventory()"}
    
    CheckPermission -->|غير مصرح| ShowError["عرض رسالة خطأ أو إخفاء الزر"]
    CheckPermission -->|مصرح| AllowAction[السماح بالإجراء]
    
    AllowAction --> ExecuteAction[تنفيذ الإجراء]
    ShowError --> End([انتهى])
    ExecuteAction --> End
```

---

## 🔟 تدفق البصمة (Attendance Flow)

```mermaid
flowchart TD
    Start([الموظف يفتح صفحة البصمة]) --> CheckAuth[التحقق من التوكن]
    
    CheckAuth --> LoadAttendance["تحميل سجلات البصمة (GET /api/attendance/my-attendance)"]
    
    LoadAttendance --> DisplayRecords[عرض السجلات في الجدول]
    
    DisplayRecords --> UserAction{إجراء المستخدم}
    
    UserAction -->|تسجيل دخول| RecordCheckIn["إرسال POST /api/attendance/check-in"]
    UserAction -->|تسجيل خروج| RecordCheckOut["إرسال POST /api/attendance/check-out"]
    UserAction -->|عرض إحصائيات| ShowStats[عرض الإحصائيات]
    
    RecordCheckIn --> CheckToday{هل تم تسجيل دخول اليوم?}
    
    CheckToday -->|نعم| ShowError["عرض رسالة: تم تسجيل الدخول مسبقاً"]
    CheckToday -->|لا| InsertCheckIn["إدراج في app_db.attendance (check_in_time = NOW(), check_out_time = NULL)"]
    
    InsertCheckIn --> Success[نجاح - تحديث الجدول]
    
    RecordCheckOut --> CheckCheckIn{هل تم تسجيل دخول اليوم?}
    
    CheckCheckIn -->|لا| ShowError2["عرض رسالة: يجب تسجيل الدخول أولاً"]
    CheckCheckIn -->|نعم| CheckCheckOut{هل تم تسجيل خروج اليوم?}
    
    CheckCheckOut -->|نعم| ShowError3["عرض رسالة: تم تسجيل الخروج مسبقاً"]
    CheckCheckOut -->|لا| UpdateCheckOut["تحديث app_db.attendance (check_out_time = NOW(), WHERE user_id = ? AND DATE(check_in_time) = CURDATE())"]
    
    UpdateCheckOut --> CalculateHours["حساب ساعات العمل (TIMEDIFF(check_out_time, check_in_time))"]
    
    CalculateHours --> UpdateHours[تحديث total_hours]
    UpdateHours --> Success
    
    ShowStats --> LoadStats["تحميل الإحصائيات (GET /api/attendance/stats)"]
    
    LoadStats --> CalculateStats["حساب: عدد أيام العمل، إجمالي الساعات، متوسط الساعات اليومية"]
    
    CalculateStats --> DisplayStats[عرض الإحصائيات]
    
    Success --> RefreshAttendance[تحديث قائمة البصمة]
    RefreshAttendance --> DisplayRecords
    
    ShowError --> DisplayRecords
    ShowError2 --> DisplayRecords
    ShowError3 --> DisplayRecords
    DisplayStats --> End([انتهى])
```

---

## 1️⃣1️⃣ تدفق الوصفات (Recipes Flow)

```mermaid
flowchart TD
    Start([المستخدم يفتح صفحة الوصفات]) --> CheckAuth[التحقق من التوكن]
    
    CheckAuth --> CheckRole{فحص الرتبة}
    
    CheckRole -->|admin/kitchen_manager| FullAccess[صلاحيات كاملة]
    CheckRole -->|موظف عادي| ViewOnly[صلاحية عرض فقط]
    CheckRole -->|غير مصرح| Redirect[إعادة التوجيه]
    
    FullAccess --> LoadRecipes["تحميل الوصفات (GET /api/recipes)"]
    ViewOnly --> LoadRecipes
    
    LoadRecipes --> DisplayRecipes[عرض الوصفات في الجدول]
    
    DisplayRecipes --> UserAction{إجراء المستخدم}
    
    UserAction -->|إضافة وصفة| ShowAddForm[فتح نموذج إضافة وصفة]
    UserAction -->|تعديل وصفة| ShowEditForm[فتح نموذج تعديل وصفة]
    UserAction -->|حذف وصفة| ConfirmDelete[طلب تأكيد الحذف]
    UserAction -->|عرض وصفة| ViewRecipe[فتح صفحة عرض الوصفة]
    UserAction -->|إنتاج وصفة| ProduceRecipe[فتح صفحة إنتاج وصفة]
    
    ShowAddForm --> FillForm["ملء النموذج: name, description, category, ingredients[], quantities[], units[]"]
    
    FillForm --> ValidateForm{التحقق من البيانات}
    
    ValidateForm -->|غير صحيح| ShowError[عرض رسالة خطأ]
    ValidateForm -->|صحيح| SendAdd["إرسال POST /api/recipes"]
    
    SendAdd --> InsertRecipe[إدراج في app_db.recipes]
    
    InsertRecipe --> InsertIngredients[إدراج المكونات في app_db.recipe_ingredients]
    
    InsertIngredients --> Success[نجاح - تحديث الجدول]
    
    ShowEditForm --> CheckPermission{هل kitchen_manager?}
    
    CheckPermission -->|نعم| NeedsApproval[يحتاج موافقة]
    CheckPermission -->|لا| DirectEdit[تعديل مباشر]
    
    NeedsApproval --> CreateApprovalRequest["إنشاء طلب موافقة (app_db.approval_requests)"]
    
    CreateApprovalRequest --> NotifyAdmin[إشعار المدير العام]
    NotifyAdmin --> WaitApproval[انتظار الموافقة]
    
    WaitApproval --> Approved{هل تمت الموافقة?}
    
    Approved -->|نعم| DirectEdit
    Approved -->|لا| ShowError2[تم رفض التعديل]
    
    DirectEdit --> LoadRecipeData[تحميل بيانات الوصفة]
    LoadRecipeData --> FillEditForm[ملء النموذج]
    FillEditForm --> ModifyData[تعديل البيانات]
    ModifyData --> ValidateEdit{التحقق}
    
    ValidateEdit -->|غير صحيح| ShowError
    ValidateEdit -->|صحيح| SendUpdate[إرسال PUT /api/recipes/:id]
    
    SendUpdate --> UpdateRecipe[تحديث app_db.recipes]
    UpdateRecipe --> UpdateIngredients[تحديث app_db.recipe_ingredients]
    UpdateIngredients --> Success
    
    ConfirmDelete --> UserConfirm{تأكيد المستخدم}
    
    UserConfirm -->|إلغاء| DisplayRecipes
    UserConfirm -->|تأكيد| SendDelete[إرسال DELETE /api/recipes/:id]
    
    SendDelete --> DeleteIngredients[حذف المكونات من app_db.recipe_ingredients]
    DeleteIngredients --> DeleteRecipe[حذف من app_db.recipes]
    DeleteRecipe --> Success
    
    ViewRecipe --> LoadFullRecipe["تحميل الوصفة الكاملة (GET /api/recipes/:id)"]
    
    LoadFullRecipe --> DisplayFull["عرض الوصفة مع المكونات (recipe-viewer.html)"]
    
    ProduceRecipe --> LoadRecipeForProduction[تحميل الوصفة للإنتاج]
    
    LoadRecipeForProduction --> CheckInventory[التحقق من توفر المكونات في المخزن]
    
    CheckInventory --> AllAvailable{هل جميع المكونات متوفرة?}
    
    AllAvailable -->|لا| ShowError3[بعض المكونات غير متوفرة]
    AllAvailable -->|نعم| CalculateRequired[حساب الكميات المطلوبة]
    
    CalculateRequired --> ShowProductionForm["عرض نموذج الإنتاج (recipe-production.html)"]
    
    ShowProductionForm --> UserConfirmProduction{تأكيد الإنتاج}
    
    UserConfirmProduction -->|إلغاء| DisplayRecipes
    UserConfirmProduction -->|تأكيد| ProcessProduction[معالجة الإنتاج]
    
    ProcessProduction --> DeductInventory[خصم المكونات من المخزن]
    DeductInventory --> RecordProduction[تسجيل الإنتاج في app_db.productions]
    
    RecordProduction --> Success
    
    Success --> RefreshRecipes[تحديث قائمة الوصفات]
    RefreshRecipes --> DisplayRecipes
    
    ShowError --> DisplayRecipes
    ShowError2 --> DisplayRecipes
    ShowError3 --> DisplayRecipes
    DisplayFull --> End([انتهى])
```

---

## 1️⃣2️⃣ تدفق قاعدة البيانات (Database Flow)

```mermaid
flowchart TD
    App([التطبيق]) --> CheckDB{نوع العملية}
    
    CheckDB -->|مصادقة/مستخدمين| AuthDB[("auth_db - قاعدة بيانات المصادقة")]
    CheckDB -->|بيانات التطبيق| AppDB[("app_db - قاعدة البيانات الرئيسية")]
    
    AuthDB --> AuthTables["الجداول: users (id, username, password hashed, role, full_name, is_active, created_at)"]
    
    AppDB --> AppTables["الجداول: inventory_items, recipes, recipe_ingredients, withdrawals, waste_records, leave_requests, attendance, notifications, approval_requests, productions"]
    
    AuthTables --> AuthConnection["اتصال معزول (authConnection.js, authPool)"]
    
    AppTables --> AppConnection["اتصال معزول (appConnection.js, appPool)"]
    
    AuthConnection --> AuthMiddleware["Middleware للتحقق (authMiddleware.js)"]
    
    AppConnection --> AppControllers["Controllers: inventoryController, recipesController, leavesController, wasteController, notificationsController, attendanceController"]
    
    AuthMiddleware --> VerifyToken[التحقق من JWT Token]
    
    VerifyToken --> ExtractUser["استخراج بيانات المستخدم (id, username, role)"]
    
    ExtractUser --> PassToController["تمرير req.user للـ Controller"]
    
    PassToController --> AppControllers
    
    AppControllers --> QueryDB[تنفيذ استعلامات SQL]
    
    QueryDB --> ReturnResults[إرجاع النتائج]
    
    ReturnResults --> JSONResponse["استجابة JSON ({ status, data, message })"]
    
    JSONResponse --> Frontend["Frontend (JavaScript)"]
    
    Frontend --> UpdateUI[تحديث واجهة المستخدم]
    
    UpdateUI --> End([انتهى])
```

---

## 📋 ملخص الصلاحيات حسب الرتب

| الرتبة | البصمة | الإجازات | المخزن | السحوبات | الوصفات | الهدر | الموظفين | الإشعارات | لوحة التحكم |
|--------|--------|----------|--------|----------|---------|-------|----------|-----------|-------------|
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **kitchen_manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **kitchen_employee** | ✅ | ✅ | 👁️ (قراءة) | ✅ (سحب فقط) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **employee** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **waiter/captain/etc** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🔄 تدفق الأخطاء (Error Handling Flow)

```mermaid
flowchart TD
    Request([طلب من Frontend]) --> SendRequest[إرسال Request]
    
    SendRequest --> ServerReceive[استقبال في Server]
    
    ServerReceive --> Middleware[Middleware Processing]
    
    Middleware --> Validation{"التحقق من البيانات (validateLogin, validateCreateUser)"}
    
    Validation -->|فشل| Return400["إرجاع 400 Bad Request ({ status: 'error', message: '...' })"]
    
    Validation -->|نجاح| AuthCheck{"التحقق من التوكن (authMiddleware)"}
    
    AuthCheck -->|غير مصرح| Return401["إرجاع 401 Unauthorized ({ status: 'error', message: '...' })"]
    
    AuthCheck -->|مصرح| RoleCheck{"التحقق من الرتبة (requireRole)"}
    
    RoleCheck -->|غير مصرح| Return403["إرجاع 403 Forbidden ({ status: 'error', message: '...' })"]
    
    RoleCheck -->|مصرح| Controller[Controller Processing]
    
    Controller --> DBQuery[استعلام قاعدة البيانات]
    
    DBQuery --> DBError{هل حدث خطأ?}
    
    DBError -->|نعم| LogError["تسجيل الخطأ في Console (console.error)"]
    
    LogError --> Return500["إرجاع 500 Internal Server Error ({ status: 'error', message: 'خطأ في السيرفر' })"]
    
    DBError -->|لا| ProcessResults[معالجة النتائج]
    
    ProcessResults --> Return200["إرجاع 200 OK ({ status: 'success', data: [...] })"]
    
    Return400 --> FrontendError[Frontend يتلقى الخطأ]
    Return401 --> FrontendError
    Return403 --> FrontendError
    Return500 --> FrontendError
    Return200 --> FrontendSuccess[Frontend يتلقى النجاح]
    
    FrontendError --> ShowErrorMsg["عرض رسالة خطأ للمستخدم (alert() أو toast)"]
    
    FrontendSuccess --> UpdateUI[تحديث واجهة المستخدم]
    
    ShowErrorMsg --> End([انتهى])
    UpdateUI --> End
```

---

## 📝 ملاحظات مهمة

1. **عزل قواعد البيانات**: 
   - `auth_db` منفصلة تماماً عن `app_db`
   - كل قاعدة بيانات لها اتصال منفصل (authPool, appPool)

2. **الأمان**:
   - جميع كلمات المرور مشفرة بـ bcrypt
   - JWT Tokens مع انتهاء صلاحية
   - التحقق من الصلاحيات في كل طلب

3. **الإشعارات**:
   - يتم إنشاؤها تلقائياً عند حدوث أحداث معينة
   - فقط المدير العام يرى الإشعارات

4. **الصلاحيات**:
   - يتم التحقق منها في Frontend (auth-check.js, permissions.js)
   - يتم التحقق منها في Backend (authMiddleware, requireRole)

5. **التحديث التلقائي**:
   - الإشعارات في Dashboard تتحدث كل 30 ثانية
   - يمكن تحديث البيانات يدوياً

---

## 🎯 الخلاصة

هذا النظام يوفر:
- ✅ نظام مصادقة وتفويض قوي
- ✅ إدارة شاملة للموظفين
- ✅ تتبع الإجازات والهدر
- ✅ إدارة المخزن والوصفات
- ✅ نظام إشعارات للمدير العام
- ✅ صلاحيات محددة حسب الرتب
- ✅ واجهة مستخدم سهلة الاستخدام

---

**تم إنشاء هذا الفلو جارت بواسطة:** AI Assistant  
**التاريخ:** 2024  
**الإصدار:** 1.0

