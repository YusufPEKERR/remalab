class ServiceError(Exception):
    """UI'ye gösterilmesi güvenli, anlamlı servis-katmanı hataları için taban sınıf."""


class ValidationError(ServiceError):
    pass


class DuplicateUsernameError(ServiceError):
    pass


class NotFoundError(ServiceError):
    pass


class InsufficientStockError(ServiceError):
    pass


class DeviceCatalogError(ServiceError):
    """DeviceCatalog servisiyle ilgili hatalar için taban sınıf."""


class DeviceCatalogConnectionError(DeviceCatalogError):
    """DeviceCatalog servisine ulaşılamadığında (bağlantı/timeout) fırlatılır."""


class DeviceCatalogAuthError(DeviceCatalogError):
    """API key eksik veya geçersiz olduğunda fırlatılır."""


class DeviceCatalogNotFoundError(DeviceCatalogError):
    """İstenen kayıt (örn. cihaz id) bulunamadığında fırlatılır."""
