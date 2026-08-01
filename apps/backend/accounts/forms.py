from django import forms


class SignupExtraFieldsForm(forms.Form):
    """Champs additionnels demandes a l'inscription.

    allauth mixe cette classe (`ACCOUNT_SIGNUP_FORM_CLASS`) dans son formulaire
    d'inscription, y compris dans l'input headless `/_allauth/<client>/v1/auth/signup`.
    `DefaultAccountAdapter.save_user` reprend `first_name`/`last_name` depuis
    `cleaned_data`, il n'y a donc rien a persister ici.
    """

    first_name = forms.CharField(max_length=150)
    last_name = forms.CharField(max_length=150)

    def signup(self, request, user):
        """Requis par allauth ; l'enregistrement est fait par l'adapter."""
