// إصلاح ظهور نافذة الإشعارات: نقلها لتكون طفلاً مباشراً لـ body
    // بدل بقائها داخل الهيدر (الذي يستخدم overflow:hidden لأغراض التصميم)،
    // لضمان ظهورها كاملة وبدون أي قصّ أو تموضع خاطئ، دون تغيير أي من وظائفها
    // (نفس المعرّفات id ونفس دوال JS تعمل كما هي تماماً).
    // ملاحظة (CLS): العنصران position:fixed بعد النقل، فلا يُحدثان إزاحة محتوى،
    // مع contain في styles.css لعزل أي إعادة تدفق داخلية.
    (function() {
        var overlay = document.getElementById('notifOverlay');
        var panel = document.getElementById('notificationsPanel');
        if (overlay) document.body.appendChild(overlay);
        if (panel) document.body.appendChild(panel);
    })();