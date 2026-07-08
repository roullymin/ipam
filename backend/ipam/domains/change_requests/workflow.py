from dataclasses import dataclass

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers


@dataclass(frozen=True)
class Transition:
    sources: frozenset
    target: str


TRANSITIONS = {
    'submit': Transition(frozenset({'draft', 'rejected'}), 'submitted'),
    'approve': Transition(frozenset({'submitted'}), 'approved'),
    'reject': Transition(frozenset({'submitted'}), 'rejected'),
    'schedule': Transition(frozenset({'approved'}), 'scheduled'),
    'complete': Transition(frozenset({'approved', 'scheduled'}), 'completed'),
    'cancel': Transition(frozenset({'draft', 'submitted', 'approved', 'scheduled'}), 'cancelled'),
}


def transition_change_request(change_request, action, *, actor_name='', updates=None):
    transition = TRANSITIONS[action]
    if change_request.status not in transition.sources:
        allowed = '、'.join(sorted(transition.sources))
        raise serializers.ValidationError(
            {'status': [f'当前状态“{change_request.get_status_display()}”不能执行该操作；允许状态：{allowed}。']}
        )

    updates = dict(updates or {})
    planned_execute_at = updates.get('planned_execute_at')
    if isinstance(planned_execute_at, str):
        parsed = parse_datetime(planned_execute_at)
        if parsed is None:
            raise serializers.ValidationError({'planned_execute_at': ['计划执行时间格式无效。']})
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        updates['planned_execute_at'] = parsed
    change_request.status = transition.target

    if action in {'approve', 'reject'}:
        change_request.reviewer_name = actor_name
        change_request.reviewed_at = timezone.now()
    if action == 'complete':
        change_request.executor_name = updates.pop('executor_name', '') or actor_name
        change_request.executed_at = timezone.now()

    update_fields = {'status', 'updated_at'}
    for field, value in updates.items():
        if value is not None:
            setattr(change_request, field, value)
            update_fields.add(field)

    if action in {'approve', 'reject'}:
        update_fields.update({'reviewer_name', 'reviewed_at'})
    if action == 'complete':
        update_fields.update({'executor_name', 'executed_at'})

    change_request.save(update_fields=sorted(update_fields))
    return change_request
