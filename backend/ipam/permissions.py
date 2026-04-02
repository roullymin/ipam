from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import UserProfile


def get_user_role(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return None

    try:
        return user.profile.role
    except UserProfile.DoesNotExist:
        return 'admin' if user.is_staff else 'guest'


class BaseRolePermission(BasePermission):
    read_roles = ()
    write_roles = ()

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        if role is None:
            return False
        allowed_roles = self.read_roles if request.method in SAFE_METHODS else self.write_roles
        return role in allowed_roles


class IpamAccessPermission(BaseRolePermission):
    read_roles = ('admin', 'dc_operator', 'ip_manager', 'auditor', 'guest')
    write_roles = ('admin', 'ip_manager')


class DcimAccessPermission(BaseRolePermission):
    read_roles = ('admin', 'dc_operator', 'ip_manager', 'auditor', 'guest')
    write_roles = ('admin', 'dc_operator')


class ResidentAccessPermission(BaseRolePermission):
    read_roles = ('admin', 'dc_operator', 'auditor')
    write_roles = ('admin', 'dc_operator')


class DatacenterChangeAccessPermission(BaseRolePermission):
    read_roles = ('admin', 'dc_operator', 'auditor')
    write_roles = ('admin', 'dc_operator')


class IpamWritePermission(BaseRolePermission):
    read_roles = ('admin', 'ip_manager')
    write_roles = ('admin', 'ip_manager')


class DcimWritePermission(BaseRolePermission):
    read_roles = ('admin', 'dc_operator')
    write_roles = ('admin', 'dc_operator')
