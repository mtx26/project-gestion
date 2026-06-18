def get_user_display_name(user):
    """Return the best human-readable name for a User instance."""
    if user is None:
        return None
    full_name = (user.get_full_name() or "").strip()
    return full_name or user.username or user.email
