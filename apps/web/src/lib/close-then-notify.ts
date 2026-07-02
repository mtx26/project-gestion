/**
 * Ferme un Popover/Dialog Radix controle puis notifie le parent au tick suivant.
 *
 * Necessaire car un re-render synchrone declenche par la notification (ex:
 * navigation Next.js, mise a jour d'un champ de formulaire) peut interrompre
 * l'animation de fermeture de Radix et provoquer un clignotement
 * ferme/rouvre/ferme.
 */
export function closeThenNotify(setOpen: (open: boolean) => void, notify: () => void) {
  setOpen(false);
  setTimeout(notify, 0);
}
