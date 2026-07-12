from django.db import transaction
from django.utils import timezone

from ..models import ExpenseRequest, FinancialEntry


def get_project_expense_requests(user, project_id):
    return ExpenseRequest.objects.for_project(project_id).accessible_to(user).with_relations()


def get_project_deleted_expense_requests(user, project_id):
    return ExpenseRequest.deleted_objects.for_project(project_id).accessible_to(user).with_relations()


def approve_expense_request(expense_request, approved_by):
    """Approve a pending expense request and create the matching expense entry."""
    with transaction.atomic():
        expense_request.status = ExpenseRequest.Status.APPROVED
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
            description=expense_request.title,
        )
        if expense_request.documents.exists():
            financial_entry.documents.set(expense_request.documents.all())

    return expense_request


def reject_expense_request(expense_request):
    expense_request.status = ExpenseRequest.Status.REJECTED
    expense_request.save()
    return expense_request
