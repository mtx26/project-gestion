from django.contrib import admin

from .models import (
    Project,
    Role,
    Permission,
    RolePermission,
    ProjectMember,
    Folder,
    Document,
    Task,
    Invitation,
    Notification,
    EmailDelivery,
    TimeEntry,
    FinancialEntry,
)

admin.site.register(Project)
admin.site.register(Role)
admin.site.register(Permission)
admin.site.register(RolePermission)
admin.site.register(ProjectMember)
admin.site.register(Folder)
admin.site.register(Document)
admin.site.register(Task)
admin.site.register(Invitation)
admin.site.register(Notification)
admin.site.register(EmailDelivery)
admin.site.register(TimeEntry)
admin.site.register(FinancialEntry)
