export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { key?: string } | undefined;
  ResendVerification: { email?: string; registered?: boolean } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { uid?: string; token?: string } | undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
};

