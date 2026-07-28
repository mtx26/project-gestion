import { forwardRef } from "react";
import type { TextInput as RNTextInput, TextInputProps } from "react-native";
import { Text, View } from "react-native";
import { Input } from "./Input";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export const FormField = forwardRef<RNTextInput, FormFieldProps>(function FormField(
  { label, error, ...inputProps },
  ref,
) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <Input ref={ref} accessibilityLabel={label} {...inputProps} />
      {error ? (
        <Text className="text-sm text-danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
