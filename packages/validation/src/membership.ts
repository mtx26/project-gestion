import { z } from "zod";
import { emailSchema } from "./shared";

export const inviteMemberSchema = z.object({
  email: emailSchema,
  roleId: z.string().min(1, "Selectionne un role"),
});
export type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;

export const roleNameSchema = z.string().min(1, "Le nom du role est requis");
