export function PageTitle({ category, title }: { category: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{category}</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
    </div>
  );
}
