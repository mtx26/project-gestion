import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "@project-gestion/ui";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Project Gestion Mobile</Text>
      <Text style={styles.subtitle}>
        Welcome to the mobile app
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
});
