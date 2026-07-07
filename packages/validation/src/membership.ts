import { z } from "zod";
import { emailSchema, requiredTextSchema } from "./shared";

export const inviteMemberSchema = z.object({
  email: emailSchema,
  roleId: z.string().min(1, "Selectionne un role"),
});
export type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;

export const roleNameSchema = requiredTextSchema("Le nom du role est requis");
