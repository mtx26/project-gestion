# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

SDK 57 (React Native 0.86). Le pin sur SDK 54 a ete leve : il tenait a un appareil de test
plafonne a SDK 54 sous Expo Go, et le flux de test passe desormais par un dev client EAS
(`eas build --profile development`, `developmentClient: true`). Avant de remonter le SDK,
verifier que l'appareil de test encaisse la version d'OS minimale de la cible.

SDK 57 est requis par `@expo/ui` : le composant `Menu` (menu natif ancre, cf.
`src/components/menus/SelectMenu.tsx`) n'existe pas avant SDK 55.
