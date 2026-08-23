"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";

type Section = {
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

type NewInspectionFormProps = {
  createInspectionAction: (formData: FormData) => Promise<void>;
  profile: {
    full_name: string;
  };
  sections: Section[];
  items: ChecklistItem[];
};

const PHOTO_FIELDS = [
  { name: "photo_front", label: "Foto frontal" },
  { name: "photo_rear", label: "Foto trasera" },
  { name: "photo_left", label: "Lado izquierdo" },
  { name: "photo_right", label: "Lado derecho" },
] as const;

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function NewInspectionForm({
  createInspectionAction,
  profile,
  sections,
  items,
}: NewInspectionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const itemsBySection = new Map<string, ChecklistItem[]>();

  items.forEach((item) => {
    const current = itemsBySection.get(item.section_id) ?? [];
    current.push(item);
    itemsBySection.set(item.section_id, current);
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const uploadedPhotoPaths: string[] = [];

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No hay usuario autenticado.");
      }

      const temporaryInspectionKey = crypto.randomUUID();

      for (const photoField of PHOTO_FIELDS) {
        const file = formData.get(photoField.name);

        if (!(file instanceof File) || file.size === 0) {
          formData.delete(photoField.name);
          continue;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          throw new Error(
            `${photoField.label} debe ser una imagen JPG, PNG o WEBP.`,
          );
        }

        if (file.size > MAX_PHOTO_SIZE) {
          throw new Error(`${photoField.label} no puede pesar más de 5 MB.`);
        }

        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: "image/webp",
          initialQuality: 0.75,
        });

        const filePath = `${user.id}/${temporaryInspectionKey}/${photoField.name}.webp`;

        const { error: uploadError } = await supabase.storage
          .from("inspection-photos")
          .upload(filePath, compressedFile, {
            contentType: compressedFile.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            `No se pudo subir ${photoField.label}: ${uploadError.message}`,
          );
        }

        uploadedPhotoPaths.push(filePath);

        formData.delete(photoField.name);
        formData.append(`${photoField.name}_path`, filePath);
      }

      await createInspectionAction(formData);
    } catch (error) {
      if (uploadedPhotoPaths.length > 0) {
        const supabase = createClient();

        await supabase.storage
          .from("inspection-photos")
          .remove(uploadedPhotoPaths);
      }

      const message =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar la inspección.";

      setErrorMessage(message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-black">
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">Nuevo registro de inspección</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Checklist de inspección y entrega final.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Datos generales</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              name="technician_name"
              label="Técnico"
              defaultValue={profile.full_name}
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

        {sections.map((section) => {
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
            {PHOTO_FIELDS.map((field) => (
              <PhotoField
                key={field.name}
                name={field.name}
                label={field.label}
              />
            ))}
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
            type="submit"
            name="intent"
            value="draft"
            disabled={isSubmitting}
            className="rounded-lg border bg-white px-5 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Guardando..." : "Guardar como inspección faltante"}
          </button>

          <button
            type="submit"
            name="intent"
            value="completed"
            disabled={isSubmitting}
            className="rounded-lg bg-black px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Guardando..." : "Marcar inspección terminada"}
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
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />
      <p className="mt-1 text-xs text-zinc-500">Máximo 5 MB.</p>
    </div>
  );
}

function getExtensionFromFile(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  const fallback = file.name.split(".").pop();

  return fallback || "jpg";
}
