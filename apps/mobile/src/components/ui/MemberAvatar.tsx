import { Image } from "expo-image";
import { Text, View } from "react-native";

interface MemberAvatarProps {
  name: string;
  pictureUrl?: string | null;
  size?: number;
}

export function MemberAvatar({ name, pictureUrl, size = 32 }: MemberAvatarProps) {
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : "?";

  if (pictureUrl) {
    return (
      <Image
        source={{ uri: pictureUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-primary/10"
    >
      <Text style={{ fontSize: size * 0.4 }} className="font-semibold text-primary">
        {initial}
      </Text>
    </View>
  );
}
