import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Message, Screen } from "../components/ui";
import { api } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import type { AuthStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "VerifyEmail">;

export function VerifyEmailScreen({ navigation, route }: Props) {
  const [message, setMessage] = useState("Verification en cours...");
  const [danger, setDanger] = useState(false);

  useEffect(() => {
    async function verify() {
      if (!route.params?.key) {
        setDanger(true);
        setMessage("Cle de verification manquante.");
        return;
      }
      try {
        await api.auth.verifyEmail(route.params.key);
        setMessage("Ton email est confirme. Tu peux maintenant te connecter.");
      } catch (caught) {
        setDanger(true);
        setMessage(getErrorMessage(caught));
      }
    }
    void verify();
  }, [route.params?.key]);

  return (
    <Screen title="Verifier l'email">
      <View className="gap-4">
        <Message danger={danger}>{message}</Message>
        <Button onPress={() => navigation.navigate("Login")}>Aller a la connexion</Button>
      </View>
    </Screen>
  );
}

