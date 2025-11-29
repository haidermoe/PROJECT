const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generatePDF() {
    console.log('🚀 بدء تحويل الفلو جارت إلى PDF...');
    
    const htmlFile = path.join(__dirname, 'flowchart-to-pdf.html');
    const outputFile = path.join(__dirname, 'FLOWCHART_A3.pdf');
    
    // قراءة ملف HTML (يحتوي على جميع المخططات)
    const html = fs.readFileSync(htmlFile, 'utf8');
    
    // لا حاجة لإضافة مخططات إضافية - الملف يحتوي على كل شيء
    /*
    const additionalFlows = `
    <!-- 6. Waste Management Flow -->
    <div class="page">
        <h2>6️⃣ تدفق إدارة الهدر (Waste Management Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- 7. Notifications Flow -->
    <div class="page">
        <h2>7️⃣ تدفق الإشعارات (Notifications Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- 8. Notification Creation Flow -->
    <div class="page">
        <h2>8️⃣ تدفق إنشاء الإشعارات (Notification Creation Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- 9. Role-Based Permissions Flow -->
    <div class="page">
        <h2>9️⃣ تدفق الصلاحيات حسب الرتب (Role-Based Permissions Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- 10. Attendance Flow -->
    <div class="page">
        <h2>🔟 تدفق البصمة (Attendance Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- 11. Recipes Flow -->
    <div class="page">
        <h2>1️⃣1️⃣ تدفق الوصفات (Recipes Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- 12. Database Flow -->
    <div class="page">
        <h2>1️⃣2️⃣ تدفق قاعدة البيانات (Database Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- 13. Error Handling Flow -->
    <div class="page">
        <h2>🔄 تدفق الأخطاء (Error Handling Flow)</h2>
        <div class="mermaid">
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
        </div>
    </div>

    <!-- Summary Table -->
    <div class="page">
        <h2>📋 ملخص الصلاحيات حسب الرتب</h2>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>الرتبة</th>
                    <th>البصمة</th>
                    <th>الإجازات</th>
                    <th>المخزن</th>
                    <th>السحوبات</th>
                    <th>الوصفات</th>
                    <th>الهدر</th>
                    <th>الموظفين</th>
                    <th>الإشعارات</th>
                    <th>لوحة التحكم</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>admin</strong></td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                </tr>
                <tr>
                    <td><strong>manager</strong></td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>✅</td>
                </tr>
                <tr>
                    <td><strong>kitchen_manager</strong></td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                </tr>
                <tr>
                    <td><strong>kitchen_employee</strong></td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>👁️ (قراءة)</td>
                    <td>✅ (سحب فقط)</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                </tr>
                <tr>
                    <td><strong>employee</strong></td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                </tr>
                <tr>
                    <td><strong>waiter/captain/etc</strong></td>
                    <td>✅</td>
                    <td>✅</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                </tr>
            </tbody>
        </table>
    </div>
    `;
    */
    
    // تشغيل المتصفح وتحويل إلى PDF
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // الانتظار حتى يتم تحميل جميع المخططات
    console.log('⏳ جاري تحميل الصفحة ورسم المخططات...');
    await page.goto(`file://${htmlFile}`, { waitUntil: 'networkidle0' });
    
    // الانتظار إضافي لرسم المخططات (Mermaid يحتاج وقت لرسم المخططات)
    console.log('⏳ جاري رسم المخططات... قد يستغرق هذا بضع دقائق...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // انتظار 10 ثواني لرسم المخططات
    
    // التحقق من أن جميع المخططات تم رسمها
    const mermaidCount = await page.$$eval('.mermaid', elements => elements.length);
    console.log(`✅ تم العثور على ${mermaidCount} مخطط`);
    
    // إنشاء PDF بحجم A3
    console.log('📄 جاري إنشاء PDF...');
    await page.pdf({
        path: outputFile,
        format: 'A3',
        landscape: true,
        printBackground: true,
        margin: {
            top: '10mm',
            right: '10mm',
            bottom: '10mm',
            left: '10mm'
        }
    });
    
    await browser.close();
    
    const fileSize = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);
    console.log(`✅ تم إنشاء PDF بنجاح!`);
    console.log(`📄 الملف: ${outputFile}`);
    console.log(`📏 الحجم: A3 Landscape`);
    console.log(`💾 حجم الملف: ${fileSize} MB`);
}

generatePDF().catch(console.error);

