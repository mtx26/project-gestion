import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/user-display";

interface MemberAvatarProps {
  name: string;
  pictureUrl: string | null | undefined;
  className?: string;
}

export function MemberAvatar({ name, pictureUrl, className }: MemberAvatarProps) {
  return (
    <Avatar className={cn("size-8 border", className)}>
      {pictureUrl ? <AvatarImage src={pictureUrl} alt={name} /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
