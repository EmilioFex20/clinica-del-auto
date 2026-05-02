import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/login/actions";

export default async function InspectionsPage() {
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

            <form action={logoutAction}>
              <button className="rounded-lg border px-4 py-2 text-sm">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
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
              </tr>
            </thead>
            <tbody>
              {inspections?.map((inspection: any) => (
                <tr key={inspection.id} className="border-t">
                  <td className="p-3 font-medium">
                    {inspection.order_number ?? "Sin orden"}
                  </td>
                  <td className="p-3">
                    {inspection.customers?.full_name ?? "Sin cliente"}
                  </td>
                  <td className="p-3">
                    {inspection.vehicles
                      ? `${inspection.vehicles.brand} ${inspection.vehicles.model} - ${inspection.vehicles.plates ?? "Sin placas"}`
                      : "Sin vehículo"}
                  </td>
                  <td className="p-3">{inspection.technician_name}</td>
                  <td className="p-3">{inspection.status}</td>
                  <td className="p-3">
                    {new Date(inspection.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}

              {!inspections?.length && (
                <tr>
                  <td className="p-6 text-center text-zinc-500" colSpan={6}>
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
