from rest_framework import authentication


class SessionAuthentication(authentication.SessionAuthentication):
    """`SessionAuthentication` qui repond 401 plutot que 403 aux anonymes.

    DRF ne renvoie 401 que si au moins une classe d'authentification expose un
    en-tete `WWW-Authenticate`. Sans cela un appel non authentifie ressort en 403,
    indistinguable d'un refus de permission cote client : le frontend ne saurait
    plus quand rediriger vers la page de connexion.

    La verification CSRF heritee de DRF reste active pour les requetes portant un
    cookie de session.
    """

    def authenticate_header(self, request):
        return "Session"
