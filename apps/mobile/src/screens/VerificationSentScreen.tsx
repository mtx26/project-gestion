import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";
import { Button, Message, Screen } from "../components/ui";
import type { AuthStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "VerificationSent">;

/** django-allauth headless n'expose pas de renvoi de lien de verification a un
 * visiteur anonyme : un nouveau lien part a chaque tentative de connexion tant que
 * l'adresse n'est pas confirmee. Cet ecran l'explique au lieu d'inventer une route. */
export function VerificationSentScreen({ navigation, route }: Props) {
  const email = route.params?.email;

  return (
    <Screen title="Verifie ton email" subtitle="Ton compte est cree.">
      <View className="gap-4">
        <Message>
          {`Un lien de verification a ete envoye${email ? ` a ${email}` : ""}. Un nouveau lien est envoye a chaque tentative de connexion tant que l'adresse n'est pas confirmee.`}
        </Message>
        <Button onPress={() => navigation.replace("Login")}>Aller a la connexion</Button>
      </View>
    </Screen>
  );
}
