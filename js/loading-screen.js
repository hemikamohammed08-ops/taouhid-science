(function() {
    var hidden = false;
    function forceHide() {
        if (hidden) return;
        hidden = true;
        var el = document.getElementById('app-loading');
        if (el) {
            el.classList.add('hidden');
            // إزالة من DOM بعد الانتقال لتوفير الموارد
            setTimeout(function() {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            }, 600);
        }
    }
    setTimeout(forceHide, 800);
    document.addEventListener('DOMContentLoaded', function() { setTimeout(forceHide, 100); });
    window.addEventListener('load', function() { setTimeout(forceHide, 50); });
})();
