import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewInspectionForm } from "./new-inspection-form";
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

  return (
    <NewInspectionForm
      createInspectionAction={createInspectionAction}
      profile={{
        full_name: profile.full_name ?? "",
      }}
      sections={sections ?? []}
      items={items ?? []}
    />
  );
}
