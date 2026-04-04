def get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR') if request else None
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown') if request else 'unknown'


def get_actor_name(user, get_profile):
    if not user or not getattr(user, 'is_authenticated', False):
        return '系统'
    try:
        profile = get_profile(user)
        return profile.display_name or user.username
    except Exception:
        return user.username


def resolve_target_display(target):
    if target is None:
        return ''
    for field in ['registration_code', 'username', 'name', 'code', 'cidr', 'ip_address']:
        value = getattr(target, field, '')
        if value:
            return str(value)
    return str(target)


def record_login(*, model, username, request, action, result, logger):
    try:
        model.objects.create(
            username=username or '',
            ip_address=get_client_ip(request),
            action=action,
            status=result,
        )
    except Exception:
        logger.exception('Failed to record login log.')


def record_audit(*, model, request, module, action, get_actor_name_fn, target=None, detail='', logger):
    try:
        user = request.user if request and getattr(request, 'user', None) and request.user.is_authenticated else None
        model.objects.create(
            user=user,
            actor_name=get_actor_name_fn(user),
            module=module,
            action=action,
            target_type=target.__class__.__name__ if target is not None else '',
            target_id=str(getattr(target, 'pk', '')) if target is not None else '',
            target_display=resolve_target_display(target),
            detail=detail or '',
            ip_address=get_client_ip(request),
        )
    except Exception:
        logger.exception('Failed to record audit log.')
