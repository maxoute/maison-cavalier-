import { Input, Select } from '@/components/ui/input';
export function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="block space-y-1 text-[12.5px] text-ink"><span>{label}</span><Input name={name} {...props} /></label>;
}
export function ResidentSelect({ residents }: { residents: { id: string; full_name: string }[] }) {
  return <label className="block space-y-1 text-[12.5px] text-ink"><span>Résident</span><Select name="resident_id" required defaultValue=""><option value="" disabled>Choisir un résident</option>{residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}</Select></label>;
}
