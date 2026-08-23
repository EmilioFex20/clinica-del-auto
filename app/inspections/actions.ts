"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const validStatuses = ["pending", "ok", "fail", "na"] as const;

type ChecklistStatus = (typeof validStatuses)[number];

const PHOTO_FIELDS = [
  { name: "photo_front", label: "Foto frontal" },
  { name: "photo_rear", label: "Foto trasera" },
  { name: "photo_left", label: "Lado izquierdo" },
  { name: "photo_right", label: "Lado derecho" },
] as const;

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getInspectionStatus(formData: FormData) {
  const intent = String(formData.get("intent") ?? "completed");

  if (intent === "draft") return "draft";
  if (intent === "completed") return "completed";

  return "completed";
}

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

function getChecklistStatus(formData: FormData, itemId: string) {
  const rawStatus = String(formData.get(`status_${itemId}`) ?? "pending");

  return validStatuses.includes(rawStatus as ChecklistStatus)
    ? (rawStatus as ChecklistStatus)
    : "pending";
}

function getExtensionFromFile(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  const fallback = file.name.split(".").pop();

  return fallback || "jpg";
}

function getPhotoFiles(formData: FormData) {
  return PHOTO_FIELDS.flatMap((photoField) => {
    const file = formData.get(photoField.name);

    if (!(file instanceof File) || file.size === 0) return [];

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(
        `${photoField.label} debe ser una imagen JPG, PNG o WEBP.`,
      );
    }

    if (file.size > MAX_PHOTO_SIZE) {
      throw new Error(`${photoField.label} no puede pesar más de 5 MB.`);
    }

    return [{ ...photoField, file }];
  });
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

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      full_name: getString(formData, "customer_name") ?? "Cliente sin nombre",
      phone: getString(formData, "phone"),
    })
    .select("id")
    .single();

  if (customerError) {
    console.error("CUSTOMER ERROR:", customerError);
    throw new Error(`No se pudo crear el cliente: ${customerError.message}`);
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
    console.error("VEHICLE ERROR:", vehicleError);
    throw new Error(`No se pudo crear el vehículo: ${vehicleError.message}`);
  }

  const photoFrontPath = formData.get("photo_front_path")?.toString() || null;
  const photoRearPath = formData.get("photo_rear_path")?.toString() || null;
  const photoLeftPath = formData.get("photo_left_path")?.toString() || null;
  const photoRightPath = formData.get("photo_right_path")?.toString() || null;

  const status = getInspectionStatus(formData);

  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .insert({
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
      photo_front_path: photoFrontPath,
      photo_rear_path: photoRearPath,
      photo_left_path: photoLeftPath,
      photo_right_path: photoRightPath,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (inspectionError) {
    console.error("INSPECTION CREATE ERROR:", inspectionError);
    throw new Error("No se pudo crear la inspección");
  }

  const { data: items, error: itemsError } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("active", true);

  if (itemsError) {
    console.error("CHECKLIST ITEMS ERROR:", itemsError);
    throw new Error("No se pudieron cargar los items del checklist");
  }

  const answers =
    items?.map((item) => ({
      inspection_id: inspection.id,
      item_id: item.id,
      status: getChecklistStatus(formData, item.id),
      value_number: getNumber(formData, `value_${item.id}`),
      notes: getString(formData, `notes_${item.id}`),
    })) ?? [];

  if (answers.length > 0) {
    const { error: answersError } = await supabase
      .from("inspection_answers")
      .insert(answers);

    if (answersError) {
      console.error("ANSWERS CREATE ERROR:", answersError);
      throw new Error("No se pudieron guardar las respuestas");
    }
  }

  redirect("/inspections");
}

export async function updateInspectionAction(
  inspectionId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, active, can_create_inspections, role")
    .eq("id", user.id)
    .single();

  if (!profile?.active || !profile.can_create_inspections) {
    redirect("/inspections?error=No tienes permiso para editar registros");
  }

  const { data: existingInspection, error: existingError } = await supabase
    .from("inspections")
    .select("id, customer_id, vehicle_id, created_by")
    .eq("id", inspectionId)
    .single();

  if (existingError || !existingInspection) {
    throw new Error("No se encontró la inspección");
  }

  const isOwner = existingInspection.created_by === user.id;
  const isAdmin = profile.role === "admin";

  if (!isOwner && !isAdmin) {
    redirect("/inspections?error=No tienes permiso para editar este registro");
  }

  const status = getInspectionStatus(formData);

  const { error: customerError } = await supabase
    .from("customers")
    .update({
      full_name: getString(formData, "customer_name") ?? "Cliente sin nombre",
      phone: getString(formData, "phone"),
    })
    .eq("id", existingInspection.customer_id);

  if (customerError) {
    console.error("CUSTOMER UPDATE ERROR:", customerError);
    throw new Error(
      `No se pudo actualizar el cliente: ${customerError.message}`,
    );
  }

  const { error: vehicleError } = await supabase
    .from("vehicles")
    .update({
      brand: getString(formData, "brand") ?? "Sin marca",
      model: getString(formData, "model") ?? "Sin modelo",
      year: getNumber(formData, "year"),
      color: getString(formData, "color"),
      plates: getString(formData, "plates"),
      vin: getString(formData, "vin"),
    })
    .eq("id", existingInspection.vehicle_id);

  if (vehicleError) {
    console.error("VEHICLE UPDATE ERROR:", vehicleError);
    throw new Error(
      `No se pudo actualizar el vehículo: ${vehicleError.message}`,
    );
  }

  const { error: inspectionError } = await supabase
    .from("inspections")
    .update({
      technician_name: getString(formData, "technician_name"),
      entry_date: getString(formData, "entry_date"),
      entry_time: getString(formData, "entry_time"),
      exit_date: getString(formData, "exit_date"),
      exit_time: getString(formData, "exit_time"),
      km_entry: getNumber(formData, "km_entry"),
      km_exit: getNumber(formData, "km_exit"),
      observations: getString(formData, "observations"),
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inspectionId);

  if (inspectionError) {
    console.error("INSPECTION UPDATE ERROR:", inspectionError);
    throw new Error(
      `No se pudo actualizar la inspección: ${inspectionError.message}`,
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("active", true);

  if (itemsError) {
    throw new Error("No se pudieron cargar los items del checklist");
  }

  const answers =
    items?.map((item) => ({
      inspection_id: inspectionId,
      item_id: item.id,
      status: getChecklistStatus(formData, item.id),
      value_number: getNumber(formData, `value_${item.id}`),
      notes: getString(formData, `notes_${item.id}`),
      updated_at: new Date().toISOString(),
    })) ?? [];

  if (answers.length > 0) {
    const { error: answersError } = await supabase
      .from("inspection_answers")
      .upsert(answers, {
        onConflict: "inspection_id,item_id",
      });

    if (answersError) {
      console.error("ANSWERS UPDATE ERROR:", answersError);
      throw new Error(
        `No se pudieron actualizar las respuestas: ${answersError.message}`,
      );
    }
  }

  redirect("/inspections");
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (error || !profile?.active || profile.role !== "admin") {
    redirect("/inspections");
  }

  return supabase;
}

export async function deleteInspectionAction(formData: FormData) {
  const supabase = await requireAdmin();

  const inspectionId = String(formData.get("inspection_id") ?? "");

  if (!isValidUuid(inspectionId)) {
    throw new Error("ID de inspección inválido");
  }

  const { data: attachments, error: attachmentsError } = await supabase
    .from("inspection_attachments")
    .select("file_path")
    .eq("inspection_id", inspectionId);

  if (attachmentsError) {
    console.error("ATTACHMENTS FETCH ERROR:", attachmentsError);
    throw new Error("No se pudieron consultar los archivos de la inspección");
  }

  const filePaths =
    attachments?.map((attachment) => attachment.file_path).filter(Boolean) ??
    [];

  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("inspection-photos")
      .remove(filePaths);

    if (storageError) {
      console.error("STORAGE DELETE ERROR:", storageError);
      throw new Error(
        `No se pudieron borrar las fotos: ${storageError.message}`,
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("inspections")
    .delete()
    .eq("id", inspectionId);

  if (deleteError) {
    console.error("INSPECTION DELETE ERROR:", deleteError);
    throw new Error(`No se pudo borrar la inspección: ${deleteError.message}`);
  }

  revalidatePath("/admin/inspections");
  revalidatePath("/inspections");
}
