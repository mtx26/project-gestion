export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { key?: string } | undefined;
  VerificationSent: { email?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { key?: string } | undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
};

