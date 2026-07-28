import { forwardRef } from "react";
import type { TextInput as RNTextInput, TextInputProps } from "react-native";
import { TextInput } from "react-native";
import { theme } from "../../theme";

export const Input = forwardRef<RNTextInput, TextInputProps>(function Input(props, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.colors.muted}
      className="h-11 min-h-[44px] rounded-md border border-border bg-surface px-3 text-base text-foreground"
      {...props}
    />
  );
});
