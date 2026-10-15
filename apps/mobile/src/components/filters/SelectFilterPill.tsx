import { SelectMenu, type SelectMenuOption } from "../menus/SelectMenu";
import { FilterPillBody } from "./FilterPill";

export interface SelectFilterPillProps {
  /** Texte de la pastille — inclut en general la valeur courante. */
  label: string;
  /** En-tete du menu (iOS seulement). */
  title?: string;
  options: SelectMenuOption[];
  value?: string;
  onSelect: (value: string) => void;
  /** Le filtre n'est plus a son defaut : la capsule prend le vert d'accentuation
   * dans une `GlassBar`. */
  active?: boolean;
}

/** Pastille de filtre qui ouvre un menu natif ancre sous elle. */
export function SelectFilterPill({
  label,
  title,
  options,
  value,
  onSelect,
  active,
}: SelectFilterPillProps) {
  return (
    <SelectMenu title={title} options={options} value={value} onSelect={onSelect}>
      <FilterPillBody label={label} active={active} />
    </SelectMenu>
  );
}
