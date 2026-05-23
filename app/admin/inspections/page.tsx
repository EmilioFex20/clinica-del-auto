import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteInspectionButton } from "./DeleteInspectionButton";

type RelatedCustomer = {
  full_name: string | null;
  phone: string | null;
};

type RelatedVehicle = {
  brand: string | null;
  model: string | null;
  plates: string | null;
};

type InspectionRow = {
  id: string;
  order_number: string | null;
  technician_name: string | null;
  status: string;
  created_at: string;
  customers: RelatedCustomer | RelatedCustomer[] | null;
  vehicles: RelatedVehicle | RelatedVehicle[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Inspección faltante",
  completed: "Inspección terminada",
  delivered: "Vehículo entregado",
  cancelled: "Cancelada",
};

export default async function AdminInspectionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active || profile.role !== "admin") {
    redirect("/inspections");
  }

  const { data: inspections, error } = await supabase
    .from("inspections")
    .select(
      `
      id,
      order_number,
      technician_name,
      status,
      created_at,
      customers (
        full_name,
        phone
      ),
      vehicles (
        brand,
        model,
        plates
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("ADMIN INSPECTIONS ERROR:", error);
    throw new Error("No se pudieron cargar las inspecciones");
  }

  const inspectionRows = (inspections ?? []) as InspectionRow[];

  return (
    <main className="min-h-screen bg-zinc-100 text-black">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm text-black">Panel de administrador</p>
            <h1 className="text-xl font-bold">Administrar inspecciones</h1>
          </div>

          <div className="flex gap-2">
            <Link
              href="/inspections"
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium"
            >
              Volver a registros
            </Link>

            <Link
              href="/inspections/new"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Nueva inspección
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 rounded-2xl bg-white p-4 shadow">
          <p className="text-sm text-zinc-600">
            Desde aquí puedes editar o borrar inspecciones. Borrar una
            inspección también elimina sus respuestas del checklist y sus
            archivos asociados si existen.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="p-3">Orden</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Vehículo</th>
                <th className="p-3">Técnico</th>
                <th className="p-3">Estatus</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {inspectionRows.map((inspection) => {
                const customer = Array.isArray(inspection.customers)
                  ? inspection.customers[0]
                  : inspection.customers;

                const vehicle = Array.isArray(inspection.vehicles)
                  ? inspection.vehicles[0]
                  : inspection.vehicles;

                const orderNumber = inspection.order_number ?? "Sin orden";

                return (
                  <tr key={inspection.id} className="border-t">
                    <td className="p-3 font-medium">{orderNumber}</td>

                    <td className="p-3">
                      <div className="font-medium">
                        {customer?.full_name ?? "Sin cliente"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {customer?.phone ?? ""}
                      </div>
                    </td>

                    <td className="p-3">
                      {vehicle
                        ? `${vehicle.brand} ${vehicle.model} - ${
                            vehicle.plates ?? "Sin placas"
                          }`
                        : "Sin vehículo"}
                    </td>

                    <td className="p-3">
                      {inspection.technician_name ?? "Sin técnico"}
                    </td>

                    <td className="p-3">
                      {STATUS_LABELS[inspection.status] ?? inspection.status}
                    </td>

                    <td className="p-3">
                      {new Date(inspection.created_at).toLocaleDateString(
                        "es-MX",
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/inspections/${inspection.id}/edit`}
                          className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                        >
                          Editar
                        </Link>

                        <DeleteInspectionButton
                          inspectionId={inspection.id}
                          orderNumber={orderNumber}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!inspectionRows.length && (
                <tr>
                  <td className="p-6 text-center text-zinc-500" colSpan={7}>
                    Todavía no hay inspecciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
