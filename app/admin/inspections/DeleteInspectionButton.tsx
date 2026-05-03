"use client";

import { deleteInspectionAction } from "@/app/inspections/actions";

export function DeleteInspectionButton({
  inspectionId,
  orderNumber,
}: {
  inspectionId: string;
  orderNumber: string;
}) {
  return (
    <form
      action={deleteInspectionAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `¿Seguro que quieres borrar la inspección ${orderNumber}? Esta acción no se puede deshacer.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="inspection_id" value={inspectionId} />

      <button className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
        Borrar
      </button>
    </form>
  );
}
