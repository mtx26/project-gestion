type MemberAvatarProps = {
  name: string;
  pictureUrl: string | null;
};

export function MemberAvatar({ name, pictureUrl }: MemberAvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pictureUrl} alt={name} className="size-8 shrink-0 rounded-full object-cover" />;
  }

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}
