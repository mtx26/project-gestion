from django.db import transaction
from django.utils import timezone

from ..models import ExpenseRequest, FinancialEntry
from .projects import get_accessible_projects


def get_project_expense_requests(user, project_id, **extra_filters):
    return ExpenseRequest.objects.filter(
        project_id=project_id,
        project__in=get_accessible_projects(user),
        **extra_filters,
    ).select_related(
        "project",
        "folder",
        "task",
        "requested_by",
        "approved_by",
    ).prefetch_related("documents")


def approve_expense_request(expense_request, approved_by):
    """Approve a pending expense request and create the matching expense entry."""
    with transaction.atomic():
        expense_request.status = ExpenseRequest.STATUS_APPROVED
        expense_request.approved_by = approved_by
        expense_request.approved_at = timezone.now()
        expense_request.save()

        financial_entry = FinancialEntry.objects.create(
            project=expense_request.project,
            folder=expense_request.folder,
            task=expense_request.task,
            created_by=approved_by,
            amount=expense_request.amount,
            type=FinancialEntry.FinancialType.EXPENSE,
            category=expense_request.category,
            description=expense_request.title,
        )
        if expense_request.documents.exists():
            financial_entry.documents.set(expense_request.documents.all())

    return expense_request


def reject_expense_request(expense_request):
    expense_request.status = ExpenseRequest.STATUS_REJECTED
    expense_request.save()
    return expense_request
