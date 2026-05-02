"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const validStatuses = ["pending", "ok", "fail", "na"] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function getNumber(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function createInspectionAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, active, can_create_inspections")
    .eq("id", user.id)
    .single();

  if (!profile?.active || !profile.can_create_inspections) {
    redirect("/inspections?error=No tienes permiso para crear registros");
  }

  const customerName = getString(formData, "customer_name");
  const phone = getString(formData, "phone");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      full_name: customerName ?? "Cliente sin nombre",
      phone,
    })
    .select("id")
    .single();

  if (customerError) {
    console.error(customerError);
    throw new Error("No se pudo crear el cliente");
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .insert({
      customer_id: customer.id,
      brand: getString(formData, "brand") ?? "Sin marca",
      model: getString(formData, "model") ?? "Sin modelo",
      year: getNumber(formData, "year"),
      color: getString(formData, "color"),
      plates: getString(formData, "plates"),
      vin: getString(formData, "vin"),
    })
    .select("id")
    .single();

  if (vehicleError) {
    console.error(vehicleError);
    throw new Error("No se pudo crear el vehículo");
  }

  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .insert({
      order_number: getString(formData, "order_number"),
      vehicle_id: vehicle.id,
      customer_id: customer.id,
      created_by: user.id,
      technician_id: user.id,
      technician_name: getString(formData, "technician_name"),
      entry_date: getString(formData, "entry_date"),
      entry_time: getString(formData, "entry_time"),
      exit_date: getString(formData, "exit_date"),
      exit_time: getString(formData, "exit_time"),
      km_entry: getNumber(formData, "km_entry"),
      km_exit: getNumber(formData, "km_exit"),
      observations: getString(formData, "observations"),
      status: "completed",
    })
    .select("id")
    .single();

  if (inspectionError) {
    console.error(inspectionError);
    throw new Error("No se pudo crear la inspección");
  }

  const { data: items, error: itemsError } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("active", true);

  if (itemsError) {
    console.error(itemsError);
    throw new Error("No se pudieron cargar los items del checklist");
  }

  const answers =
    items?.map((item) => {
      const rawStatus = String(formData.get(`status_${item.id}`) ?? "pending");

      const status = validStatuses.includes(rawStatus as any)
        ? rawStatus
        : "pending";

      return {
        inspection_id: inspection.id,
        item_id: item.id,
        status,
        value_number: getNumber(formData, `value_${item.id}`),
        notes: getString(formData, `notes_${item.id}`),
      };
    }) ?? [];

  if (answers.length > 0) {
    const { error: answersError } = await supabase
      .from("inspection_answers")
      .insert(answers);

    if (answersError) {
      console.error(answersError);
      throw new Error("No se pudieron guardar las respuestas");
    }
  }

  redirect("/inspections");
}
