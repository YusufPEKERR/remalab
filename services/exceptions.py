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
