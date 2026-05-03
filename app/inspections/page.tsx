import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/login/actions";

export default async function InspectionsPage() {
  const STATUS_LABELS: Record<string, string> = {
    draft: "Inspección faltante",
    completed: "Inspección terminada",
    delivered: "Vehículo entregado",
    cancelled: "Cancelada",
  };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, active, can_create_inspections")
    .eq("id", user.id)
    .single();

  console.log("USER ID:", user.id);
  console.log("PROFILE:", profile);
  console.log("PROFILE ERROR:", profileError);

  if (profileError) {
    redirect(`/login?error=${encodeURIComponent(profileError.message)}`);
  }

  if (!profile) {
    redirect("/login?error=No existe perfil para este usuario");
  }

  if (!profile.active) {
    redirect("/login?error=Usuario no activo");
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
      vehicles (
        brand,
        model,
        plates
      ),
      customers (
        full_name,
        phone
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-black">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">Registros de inspección</h1>
            <p className="text-sm text-black">Sesión: {profile.full_name}</p>
          </div>

          <div className="flex gap-2">
            {profile.can_create_inspections && (
              <Link
                href="/inspections/new"
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Nuevo registro
              </Link>
            )}
            {profile.role === "admin" && (
              <Link
                href="/admin/inspections"
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Admin
              </Link>
            )}

            <form action={logoutAction}>
              <button className="rounded-lg border px-4 py-2 text-sm">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        {/* Vista móvil: cards */}
        <div className="grid gap-3 md:hidden">
          {inspections?.map((inspection: any) => {
            const customer = Array.isArray(inspection.customers)
              ? inspection.customers[0]
              : inspection.customers;

            const vehicle = Array.isArray(inspection.vehicles)
              ? inspection.vehicles[0]
              : inspection.vehicles;

            return (
              <div
                key={inspection.id}
                className="rounded-2xl bg-white p-4 shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {inspection.order_number ?? "Sin orden"}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {customer?.full_name ?? "Sin cliente"}
                    </p>
                  </div>

                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs">
                    {STATUS_LABELS[inspection.status] ?? inspection.status}
                  </span>
                </div>

                <p className="mt-3 text-sm">
                  {vehicle
                    ? `${vehicle.brand} ${vehicle.model} - ${
                        vehicle.plates ?? "Sin placas"
                      }`
                    : "Sin vehículo"}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Técnico: {inspection.technician_name ?? "Sin técnico"}
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(inspection.created_at).toLocaleDateString("es-MX")}
                </p>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/inspections/${inspection.id}/edit`}
                    className="flex-1 rounded-xl border px-3 py-2 text-center text-sm font-medium"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            );
          })}

          {!inspections?.length && (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 shadow">
              Todavía no hay registros.
            </div>
          )}
        </div>

        {/* Vista desktop: tabla */}
        <div className="hidden overflow-hidden rounded-2xl bg-white shadow md:block">
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
              {inspections?.map((inspection: any) => {
                const customer = Array.isArray(inspection.customers)
                  ? inspection.customers[0]
                  : inspection.customers;

                const vehicle = Array.isArray(inspection.vehicles)
                  ? inspection.vehicles[0]
                  : inspection.vehicles;

                return (
                  <tr key={inspection.id} className="border-t">
                    <td className="p-3 font-medium">
                      {inspection.order_number ?? "Sin orden"}
                    </td>

                    <td className="p-3">
                      {customer?.full_name ?? "Sin cliente"}
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
                      <Link
                        href={`/inspections/${inspection.id}/edit`}
                        className="rounded-lg border px-3 py-1 text-sm"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {!inspections?.length && (
                <tr>
                  <td className="p-6 text-center text-zinc-500" colSpan={7}>
                    Todavía no hay registros.
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
