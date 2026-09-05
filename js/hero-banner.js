// إظهار منطقة المراحل بعد الضغط على زر "اختر مرحلتك الدراسية"
function revealStageArea(scroll) {
    var opened = false;
    var nodes = document.querySelectorAll('[data-stage-gate="closed"]');
    for (var i = 0; i < nodes.length; i++) { 
        nodes[i].removeAttribute('data-stage-gate'); 
        opened = true; 
    }
    var target = document.getElementById('mainStagesContainer');
    if (target && scroll !== false) {
        setTimeout(function(){ 
            target.scrollIntoView({behavior:'smooth', block:'start'}); 
        }, opened ? 80 : 0);
    }
}
window.revealStageArea = revealStageArea;

(function () {
    // أي محتوى يُحمَّل داخل منطقة الدروس يفتح البوابة تلقائياً
    var area = document.getElementById('dynamicArea');
    if (area && window.MutationObserver) {
        new MutationObserver(function(){
            if (area.getAttribute('data-stage-gate') !== 'closed') return;
            // تجاهل بطاقة الترحيب الافتراضية
            var onlyWelcome = area.children.length <= 1 && area.querySelector('.welcome-new');
            if (onlyWelcome) return;
            if (area.textContent.trim() === '') return;
            revealStageArea(false);
        }).observe(area, { childList: true, subtree: true });
    }
})();

(function() {
    var host = document.getElementById('heroParticles');
    if (!host) return;
    var count = window.innerWidth < 640 ? 10 : 18;
    for (var i = 0; i < count; i++) {
        var p = document.createElement('span');
        p.className = 'hero-particle';
        var size = 3 + Math.random() * 5;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = (Math.random() * 100) + '%';
        p.style.setProperty('--drift', (Math.random() * 40 - 20) + 'px');
        p.style.animationDuration = (9 + Math.random() * 10) + 's';
        p.style.animationDelay = (Math.random() * 12) + 's';
        host.appendChild(p);
    }
})();
