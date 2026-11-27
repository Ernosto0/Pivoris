"""Fixed external channel notification texts for subscription billing (ADR-029).

Registered into ``app.notifications.quota_text`` when ``app.handlers.load_handlers()`` runs so
Web Push and Telegram adapters render localized copy without importing ``app.hosted``.
"""

from app.notifications.quota_text import register_notification_texts

TEXT: dict[str, dict[str, tuple[str, str]]] = {
    "billing.trial_ending": {
        "en": (
            "Your free trial ends soon",
            "Choose a plan in Billing so AI replies continue without interruption.",
        ),
        "tr": (
            "Ücretsiz deneme süreniz yakında bitiyor",
            "Yapay zekâ yanıtlarının kesintisiz sürmesi için Abonelik sayfasından plan seçin.",
        ),
    },
    "billing.payment_failed": {
        "en": (
            "Subscription payment could not be collected",
            "Update your card in Billing within the 7-day grace period to avoid interruption.",
        ),
        "tr": (
            "Abonelik ödemesi alınamadı",
            "Kesinti olmaması için 7 günlük ek sürede Abonelik sayfasından kartınızı güncelleyin.",
        ),
    },
    "billing.paused": {
        "en": (
            "AI drafting is paused due to billing",
            "Messages still arrive in your inbox. Open Billing to subscribe or update payment.",
        ),
        "tr": (
            "Faturalandırma nedeniyle yapay zekâ duraklatıldı",
            "Mesajlar gelen kutunuza düşmeye devam eder. Devam etmek için Abonelik sayfasını açın.",
        ),
    },
    "billing.activated": {
        "en": (
            "Your subscription is active",
            "AI reply drafting and content generation are active for your workspace.",
        ),
        "tr": (
            "Aboneliğiniz etkinleştirildi",
            "Yapay zekâ yanıt ve içerik üretimi çalışma alanınızda aktif.",
        ),
    },
}

register_notification_texts(TEXT)
