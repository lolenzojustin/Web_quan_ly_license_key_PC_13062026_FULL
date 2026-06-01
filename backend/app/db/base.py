# Import all the models, so that Base has them before being
# imported by Alembic or database setup scripts.
from app.db.base_class import Base  # noqa
from app.models.admin import Admin  # noqa
from app.models.category import Category  # noqa
from app.models.license import License  # noqa
from app.models.activation import LicenseActivation  # noqa
