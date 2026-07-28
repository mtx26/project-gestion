import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/errors";

export function VerifyEmailScreen() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key?: string }>();
  const [message, setMessage] = useState("Verification en cours...");
  const [danger, setDanger] = useState(false);

  useEffect(() => {
    async function verify() {
      if (!key) {
        setDanger(true);
        setMessage("Cle de verification manquante.");
        return;
      }
      try {
        await api.auth.verifyEmail(key);
        setMessage("Ton email est confirme. Tu peux maintenant te connecter.");
      } catch (caught) {
        setDanger(true);
        setMessage(getErrorMessage(caught));
      }
    }
    void verify();
  }, [key]);

  return (
    <Screen title="Verifier l'email">
      <InlineMessage variant={danger ? "danger" : "info"}>{message}</InlineMessage>
      <Button onPress={() => router.push("/")}>Aller a la connexion</Button>
    </Screen>
  );
}
