import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateInspectionAction } from "../../actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ChecklistSection = {
  id: string;
  code: string;
  title: string;
  sort_order: number;
};

type ChecklistItem = {
  id: string;
  section_id: string;
  code: string;
  label: string;
  subgroup: string | null;
  sort_order: number;
  is_optional: boolean;
  requires_value: boolean;
  value_type: string | null;
};

type InspectionAnswer = {
  item_id: string;
  status: "pending" | "ok" | "fail" | "na";
  value_number: number | null;
  notes: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Inspección faltante",
  completed: "Inspección terminada",
  delivered: "Vehículo entregado",
  cancelled: "Cancelada",
};

export default async function EditInspectionPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active, can_create_inspections, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile?.active || !profile.can_create_inspections) {
    redirect("/inspections");
  }

  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .select(
      `
      id,
      order_number,
      technician_name,
      entry_date,
      entry_time,
      exit_date,
      exit_time,
      km_entry,
      km_exit,
      observations,
      status,
      customer_id,
      vehicle_id,
      created_by,
      photo_front_path,
      photo_rear_path,
      photo_left_path,
      photo_right_path,
      customers (
        id,
        full_name,
        phone
      ),
      vehicles (
        id,
        brand,
        model,
        year,
        color,
        plates,
        vin
      )
    `,
    )
    .eq("id", id)
    .single();

  if (inspectionError || !inspection) {
    notFound();
  }

  const isOwner = inspection.created_by === user.id;
  const isAdmin = profile.role === "admin";

  if (!isOwner && !isAdmin) {
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

  const { data: answers } = await supabase
    .from("inspection_answers")
    .select("item_id, status, value_number, notes")
    .eq("inspection_id", id);

  const itemsBySection = new Map<string, ChecklistItem[]>();

  (items as ChecklistItem[] | null)?.forEach((item) => {
    const current = itemsBySection.get(item.section_id) ?? [];
    current.push(item);
    itemsBySection.set(item.section_id, current);
  });

  const answerMap = new Map<string, InspectionAnswer>();

  (answers as InspectionAnswer[] | null)?.forEach((answer) => {
    answerMap.set(answer.item_id, answer);
  });

  const updateAction = updateInspectionAction.bind(null, id);

  const customer = Array.isArray(inspection.customers)
    ? inspection.customers[0]
    : inspection.customers;

  const vehicle = Array.isArray(inspection.vehicles)
    ? inspection.vehicles[0]
    : inspection.vehicles;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-black">
      <form action={updateAction} className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-zinc-500">Editar inspección</p>
              <h1 className="text-2xl font-bold">
                {inspection.order_number ?? "Sin número de orden"}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Estatus actual:{" "}
                <span className="font-medium text-zinc-800">
                  {STATUS_LABELS[inspection.status] ?? inspection.status}
                </span>
              </p>
            </div>

            <Link
              href="/inspections"
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium"
            >
              Volver
            </Link>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Datos generales</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ReadonlyField
              label="Orden No."
              value={inspection.order_number ?? "Se generó automáticamente"}
            />

            <Field
              name="technician_name"
              label="Técnico"
              defaultValue={
                inspection.technician_name ?? profile.full_name ?? ""
              }
            />

            <Field
              name="entry_date"
              label="Fecha entrada"
              type="date"
              defaultValue={inspection.entry_date}
            />

            <Field
              name="entry_time"
              label="Hora entrada"
              type="time"
              defaultValue={formatTime(inspection.entry_time)}
            />

            <Field
              name="exit_date"
              label="Fecha salida"
              type="date"
              defaultValue={inspection.exit_date}
            />

            <Field
              name="exit_time"
              label="Hora salida"
              type="time"
              defaultValue={formatTime(inspection.exit_time)}
            />

            <Field
              name="customer_name"
              label="Cliente"
              required
              defaultValue={customer?.full_name ?? ""}
            />

            <Field
              name="phone"
              label="Teléfono"
              defaultValue={customer?.phone ?? ""}
            />

            <Field
              name="brand"
              label="Marca"
              required
              defaultValue={vehicle?.brand ?? ""}
            />

            <Field
              name="model"
              label="Modelo"
              required
              defaultValue={vehicle?.model ?? ""}
            />

            <Field
              name="year"
              label="Año"
              type="number"
              defaultValue={vehicle?.year ?? ""}
            />

            <Field
              name="color"
              label="Color"
              defaultValue={vehicle?.color ?? ""}
            />

            <Field
              name="plates"
              label="Placas"
              defaultValue={vehicle?.plates ?? ""}
            />

            <Field name="vin" label="VIN" defaultValue={vehicle?.vin ?? ""} />

            <Field
              name="km_entry"
              label="Km entrada"
              type="number"
              defaultValue={inspection.km_entry ?? ""}
            />

            <Field
              name="km_exit"
              label="Km salida"
              type="number"
              defaultValue={inspection.km_exit ?? ""}
            />
          </div>
        </section>

        {(sections as ChecklistSection[] | null)?.map((section) => {
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
                {sectionItems.map((item) => {
                  const answer = answerMap.get(item.id);

                  return (
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
                          defaultValue={answer?.status ?? "pending"}
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
                            max={
                              item.value_type === "percent" ? 100 : undefined
                            }
                            defaultValue={answer?.value_number ?? ""}
                            className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                          />
                        </div>
                      )}

                      <div className="mt-3">
                        <label className="text-sm text-zinc-600">Notas</label>

                        <input
                          name={`notes_${item.id}`}
                          defaultValue={answer?.notes ?? ""}
                          className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
                          placeholder="Observación opcional"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Observaciones</h2>

          <textarea
            name="observations"
            rows={5}
            defaultValue={inspection.observations ?? ""}
            className="mt-4 w-full rounded-lg border px-3 py-2"
            placeholder="Observaciones generales del vehículo..."
          />
        </section>

        <div className="flex flex-col justify-end gap-3 rounded-2xl bg-white p-4 shadow md:flex-row">
          <Link
            href="/inspections"
            className="rounded-lg border bg-white px-5 py-2 text-center font-medium"
          >
            Cancelar
          </Link>

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
  defaultValue?: string | number | null;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>

      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">{label}</label>

      <div className="mt-1 rounded-lg border bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
        {value}
      </div>
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}
