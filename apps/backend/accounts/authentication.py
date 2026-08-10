from django.contrib.auth import get_user
from rest_framework.authentication import BaseAuthentication

from allauth.headless.app_settings import TOKEN_STRATEGY


class HeadlessSessionTokenAuthentication(BaseAuthentication):
    """Authentifie les requetes DRF du client "app" d'allauth Headless
    (mobile), qui envoie le token de session dans l'en-tete X-Session-Token
    plutot que via un cookie.

    Reutilise TOKEN_STRATEGY.lookup_session — le meme mecanisme qu'allauth
    utilise en interne pour ses propres vues headless/app — puis resout
    l'utilisateur nativement via django.contrib.auth.get_user, exactement
    comme AuthenticationMiddleware le fait depuis request.session pour une
    session cookie classique.
    """

    def authenticate_header(self, request):
        # DRF ne repond 401 (au lieu de 403) que si le *premier* authenticator
        # expose un en-tete WWW-Authenticate. SessionAuthentication renvoie
        # None ici, d'ou l'ordre choisi dans DEFAULT_AUTHENTICATION_CLASSES :
        # cette classe d'abord, pour que web et mobile recoivent bien un 401
        # sur session expiree (c'est ce que guette `onSessionInvalid`).
        return "X-Session-Token"

    def authenticate(self, request):
        token = request.META.get("HTTP_X_SESSION_TOKEN")
        if not token:
            return None

        session = TOKEN_STRATEGY.lookup_session(token)
        if session is None:
            return None

        request.session = session
        user = get_user(request)
        if not user.is_authenticated:
            return None

        return (user, None)
