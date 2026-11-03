"use server";

import { revalidatePath } from "next/cache";
import { ComplianceService } from "@/lib/services/compliance";
import { CatalogService } from "@/lib/services/catalog";
import { requireRole } from "@/lib/supabase/authorization";
import { validateEnvironmentalReading } from "@/lib/validation/environmental-reading";
import { getDateKeyInBusinessTimeZone } from "@/lib/dates";
import { redirect } from "next/navigation";

export async function updateTemperatureRange(formData: FormData) {
    await requireRole(["admin"]);
    const locationId = String(formData.get("location_id") || "").trim();
    const rawMin = String(formData.get("temperature_min") || "").trim();
    const rawMax = String(formData.get("temperature_max") || "").trim();
    const temperatureMin = rawMin ? Number(rawMin) : Number.NaN;
    const temperatureMax = rawMax ? Number(rawMax) : Number.NaN;

    if (!locationId || !Number.isFinite(temperatureMin) || !Number.isFinite(temperatureMax) || temperatureMin >= temperatureMax) {
        redirect(`/dashboard/monitoreo?location=${encodeURIComponent(locationId)}&rangeError=${encodeURIComponent("Ingresa límites numéricos válidos. El mínimo debe ser menor que el máximo.")}`);
    }

    const { data: locations } = await CatalogService.getLocations();
    if (!locations?.some(location => location.id === locationId)) {
        redirect(`/dashboard/monitoreo?rangeError=${encodeURIComponent("No se encontró la ubicación seleccionada.")}`);
    }

    const { error } = await CatalogService.updateLocationTemperatureRange(locationId, temperatureMin, temperatureMax);
    if (error) {
        redirect(`/dashboard/monitoreo?location=${encodeURIComponent(locationId)}&rangeError=${encodeURIComponent(`No se pudo guardar el rango: ${error.message}`)}`);
    }

    revalidatePath("/dashboard/monitoreo");
    revalidatePath("/dashboard/configuracion");
    redirect(`/dashboard/monitoreo?location=${encodeURIComponent(locationId)}&rangeSaved=1`);
}

export async function submitEnvironmentalLog(formData: FormData) {
    await requireRole(["admin", "operator"]);
    const location_id = formData.get("location_id") as string;
    const rawTemperature = String(formData.get("temperature") || "").trim();
    const temperature = rawTemperature ? Number(rawTemperature) : Number.NaN;
    const humidityNotApplicable = formData.get("humidity_not_applicable") === "on";
    const rawHumidity = humidityNotApplicable ? "" : String(formData.get("humidity") || "").trim();
    const humidity = rawHumidity ? Number(rawHumidity) : undefined;
    const notes = String(formData.get("notes") || "").trim();
    const readingType = formData.get("reading_type") === "pm" ? "pm" : "am";
    const isCorrection = formData.get("is_correction") === "on";

    if (!location_id || !Number.isFinite(temperature) || (humidity !== undefined && !Number.isFinite(humidity))) {
        throw new Error("Datos obligatorios faltantes");
    }
    if (!humidityNotApplicable && !rawHumidity) {
        throw new Error("Ingresa la humedad o marca N/A si no aplica.");
    }

    try {
        const readingDate = getDateKeyInBusinessTimeZone(new Date());
        const alreadyRegistered = await ComplianceService.hasEnvironmentalReadingForShift(location_id, readingDate, readingType);
        const validationError = validateEnvironmentalReading({ alreadyRegistered, isCorrection, notes });
        if (validationError) throw new Error(validationError);

        await ComplianceService.recordEnvironmentalLog({
            location_id,
            temperature,
            humidity,
            notes: notes || undefined,
            reading_type: readingType,
            is_correction: isCorrection,
        });
        revalidatePath("/dashboard/monitoreo");
    } catch (error: unknown) {
        console.error("Error submitting environmental log:", error);
        throw error;
    }
}
