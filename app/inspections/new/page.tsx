import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createInspectionAction } from "../actions";

export default async function NewInspectionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active, can_create_inspections, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.active || !profile.can_create_inspections) {
    redirect("/inspections");
  }

  const { data: sections } = await supabase
    .from("checklist_sections")
    .select("id, code, title, sort_order")
    .order("sort_order", { ascending: true });

  const { data: items } = await supabase
    .from("checklist_items")
    .select(
      "id, section_id, code, label, subgroup, sort_order, is_optional, requires_value, value_type",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const itemsBySection = new Map<string, typeof items>();

  items?.forEach((item) => {
    const current = itemsBySection.get(item.section_id) ?? [];
    current.push(item);
    itemsBySection.set(item.section_id, current);
  });

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-black">
      <form
        action={createInspectionAction}
        className="mx-auto max-w-5xl space-y-6"
      >
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">Nuevo registro de inspección</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Checklist de inspección y entrega final.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Datos generales</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              name="technician_name"
              label="Técnico"
              defaultValue={profile.full_name ?? ""}
            />

            <Field name="entry_date" label="Fecha entrada" type="date" />
            <Field name="entry_time" label="Hora entrada" type="time" />
            <Field name="exit_date" label="Fecha salida" type="date" />
            <Field name="exit_time" label="Hora salida" type="time" />

            <Field name="customer_name" label="Cliente" required />
            <Field name="phone" label="Teléfono" />

            <Field name="brand" label="Marca" required />
            <Field name="model" label="Modelo" required />
            <Field name="year" label="Año" type="number" />
            <Field name="color" label="Color" />
            <Field name="plates" label="Placas" />
            <Field name="vin" label="VIN" />

            <Field name="km_entry" label="Km entrada" type="number" />
            <Field name="km_exit" label="Km salida" type="number" />
          </div>
        </section>

        {sections?.map((section) => {
          const sectionItems = itemsBySection.get(section.id) ?? [];

          return (
            <section
              key={section.id}
              className="rounded-2xl bg-white p-6 shadow"
            >
              <h2 className="text-lg font-semibold">
                {section.sort_order}. {section.title}
              </h2>

              <div className="mt-4 space-y-4">
                {sectionItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border bg-zinc-50 p-4"
                  >
                    {item.subgroup && (
                      <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                        {item.subgroup}
                      </p>
                    )}

                    <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        {item.is_optional && (
                          <p className="text-xs text-zinc-500">
                            Opcional / si aplica
                          </p>
                        )}
                      </div>

                      <select
                        name={`status_${item.id}`}
                        defaultValue="pending"
                        className="rounded-lg border bg-white px-3 py-2"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="ok">Correcto</option>
                        <option value="fail">Falla</option>
                        <option value="na">No aplica</option>
                      </select>
                    </div>

                    {item.requires_value && (
                      <div className="mt-3">
                        <label className="text-sm text-zinc-600">
                          Valor {item.value_type === "percent" ? "(%)" : ""}
                        </label>
                        <input
                          name={`value_${item.id}`}
                          type="number"
                          min={item.value_type === "percent" ? 0 : undefined}
                          max={item.value_type === "percent" ? 100 : undefined}
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                        />
                      </div>
                    )}

                    <div className="mt-3">
                      <label className="text-sm text-zinc-600">Notas</label>
                      <input
                        name={`notes_${item.id}`}
                        className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                        placeholder="Observación opcional"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Observaciones</h2>
          <textarea
            name="observations"
            rows={5}
            className="mt-4 w-full rounded-lg border px-3 py-2"
            placeholder="Observaciones generales del vehículo..."
          />
        </section>
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Fotos del vehículo</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Sube de 3 a 4 fotos del carro antes de entregar el registro.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <PhotoField name="photo_front" label="Foto frontal" />
            <PhotoField name="photo_rear" label="Foto trasera" />
            <PhotoField name="photo_left" label="Lado izquierdo" />
            <PhotoField name="photo_right" label="Lado derecho" />
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <a
            href="/inspections"
            className="rounded-lg border bg-white px-5 py-2 font-medium"
          >
            Cancelar
          </a>

          <button
            name="intent"
            value="draft"
            className="rounded-lg border bg-white px-5 py-2 font-medium"
          >
            Guardar como inspección faltante
          </button>

          <button
            name="intent"
            value="completed"
            className="rounded-lg bg-black px-5 py-2 font-medium text-white"
          >
            Marcar inspección terminada
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />
    </div>
  );
}

function PhotoField({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        name={name}
        type="file"
        accept="image/*"
        capture="environment"
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />
    </div>
  );
}
