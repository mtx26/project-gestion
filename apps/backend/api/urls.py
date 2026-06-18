from django.urls import path
from .views.projects import (
    ProjectListCreateView,
    ProjectDetailView,
    ProjectRestoreView,
    ProjectTrashListView
)
from .views.roles import (
    PermissionListView,
    RoleListCreateView,
    RoleDetailView,
)
from .views.members import (
    ProjectMemberListView,
    ProjectMemberDetailView
)
from .views.invitations import (
    InvitationAcceptView,
    InvitationDetailView,
    InvitationListCreateView,
)
from .views.notifications import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationUnreadCountView,
)
from .views.users import UserListView
from .views.folders import (
    FolderListCreateView,
    FolderDetailView,
    FolderTrashListView,
    FolderRestoreView,
    FolderTargetTreeView,
    FolderTreeView,
)
from .views.documents import (
    DocumentListCreateView,
    DocumentDetailView,
    DocumentDownloadView,
)
from .views.tasks import (
    TaskListCreateView,
    TaskDetailView,
    TaskTrashListView,
    TaskRestoreView,
)
from .views.time_entries import (
    TimeEntryListCreateView,
    TimeEntryDetailView,
    TimeEntryPaymentView,
    TimeEntryTrashListView,
    TimeEntryRestoreView,
)
from .views.financial_entries import (
    FinancialEntryChartView,
    FinancialEntryListCreateView,
    FinancialEntryDetailView,
    FinancialEntryTrashListView,
    FinancialEntryRestoreView,
)
from .views.expense_requests import (
    ExpenseRequestListCreateView,
    ExpenseRequestDetailView,
    ExpenseRequestApproveView,
    ExpenseRequestRejectView,
)


urlpatterns = [
    path("users/", UserListView.as_view(), name="user-list"),
    # Projects
    path("projects/", ProjectListCreateView.as_view(), name="project-list-create"),
    path("projects/<int:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/trash/", ProjectTrashListView.as_view(), name="project-trash-list"),
    path("projects/<int:pk>/restore/", ProjectRestoreView.as_view(), name="project-restore"),
    # Roles
    path("projects/<int:project_id>/roles/", RoleListCreateView.as_view(), name="project-roles"),
    path("projects/<int:project_id>/roles/<int:pk>/", RoleDetailView.as_view(), name="project-role-detail"),
    path("permissions/", PermissionListView.as_view(), name="permission-list"),
    # Members
    path("projects/<int:project_id>/members/", ProjectMemberListView.as_view(), name="project-members"),
    path("projects/<int:project_id>/members/<int:pk>/", ProjectMemberDetailView.as_view(), name="project-member-detail"),
    path("projects/<int:project_id>/invitations/", InvitationListCreateView.as_view(), name="project-invitations"),
    path("projects/<int:project_id>/invitations/<int:pk>/", InvitationDetailView.as_view(), name="project-invitation-detail"),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invitation-accept"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/unread-count/", NotificationUnreadCountView.as_view(), name="notification-unread-count"),
    path("notifications/mark-all-read/", NotificationMarkAllReadView.as_view(), name="notification-mark-all-read"),
    path("notifications/<int:pk>/mark-read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
    # Folders
    path("projects/<int:project_id>/folders/", FolderListCreateView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/tree/", FolderTreeView.as_view(), name="project-folder-tree"),
    path("projects/<int:project_id>/folders/target-tree/", FolderTargetTreeView.as_view(), name="project-folder-target-tree"),
    path("projects/<int:project_id>/folders/<int:pk>/", FolderDetailView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/trash/", FolderTrashListView.as_view(), name="project-folders"),
    path("projects/<int:project_id>/folders/<int:pk>/restore/", FolderRestoreView.as_view(), name="project-folders"),
    # Documents
    path("projects/<int:project_id>/documents/", DocumentListCreateView.as_view(), name="project-documents"),
    path("projects/<int:project_id>/documents/<int:pk>/", DocumentDetailView.as_view(), name="project-document-detail"),
    path("projects/<int:project_id>/documents/<int:pk>/download/", DocumentDownloadView.as_view(), name="project-document-download"),
    # Tasks
    path("projects/<int:project_id>/tasks/", TaskListCreateView.as_view(), name="project-tasks"),
    path("projects/<int:project_id>/tasks/trash/", TaskTrashListView.as_view(), name="project-tasks-trash"),
    path("projects/<int:project_id>/tasks/<int:pk>/", TaskDetailView.as_view(), name="project-task-detail"),
    path("projects/<int:project_id>/tasks/<int:pk>/restore/", TaskRestoreView.as_view(), name="project-task-restore"),
    # Time Entries
    path("projects/<int:project_id>/time-entries/", TimeEntryListCreateView.as_view(), name="project-time-entries"),
    path("projects/<int:project_id>/time-entries/trash/", TimeEntryTrashListView.as_view(), name="project-time-entries-trash"),
    path("projects/<int:project_id>/time-entries/<int:pk>/pay/", TimeEntryPaymentView.as_view(), name="project-time-entry-payment"),
    path("projects/<int:project_id>/time-entries/<int:pk>/", TimeEntryDetailView.as_view(), name="project-time-entry-detail"),
    path("projects/<int:project_id>/time-entries/<int:pk>/restore/", TimeEntryRestoreView.as_view(), name="project-time-entry-restore"),
    # Financial Entries
    path("projects/<int:project_id>/financial-entries/", FinancialEntryListCreateView.as_view(), name="project-financial-entries"),
    path("projects/<int:project_id>/financial-entries/chart/", FinancialEntryChartView.as_view(), name="project-financial-entries-chart"),
    path("projects/<int:project_id>/financial-entries/trash/", FinancialEntryTrashListView.as_view(), name="project-financial-entries-trash"),
    path("projects/<int:project_id>/financial-entries/<int:pk>/", FinancialEntryDetailView.as_view(), name="project-financial-entry-detail"),
    path("projects/<int:project_id>/financial-entries/<int:pk>/restore/", FinancialEntryRestoreView.as_view(), name="project-financial-entry-restore"),
    # Expense Requests
    path("projects/<int:project_id>/expense-requests/", ExpenseRequestListCreateView.as_view(), name="project-expense-requests"),
    path("projects/<int:project_id>/expense-requests/<int:pk>/", ExpenseRequestDetailView.as_view(), name="project-expense-request-detail"),
    path("projects/<int:project_id>/expense-requests/<int:pk>/approve/", ExpenseRequestApproveView.as_view(), name="project-expense-request-approve"),
    path("projects/<int:project_id>/expense-requests/<int:pk>/reject/", ExpenseRequestRejectView.as_view(), name="project-expense-request-reject"),
]
