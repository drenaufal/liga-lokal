import { z } from "zod";
import { optionalInt, requiredInt } from "@/lib/form";
import { imageUrlField } from "@/lib/media";
import type { TFunction } from "@/lib/i18n/translate";
import { msg } from "@/lib/i18n/translate";

export const VENUE_SURFACE = {
  natural: msg("Rumput alami"),
  artificial: msg("Rumput sintetis"),
  hybrid: "Hybrid",
  futsal: "Futsal",
};

export const makeVenueSchema = (t: TFunction) => z.object({
  name: z.string().trim().min(3, t("Nama venue minimal 3 karakter")).max(200, t("Nama maksimal 200 karakter")),
  city: z.string().trim().min(2, t("Kota wajib diisi")).max(120),
  province: z.string().trim().max(120).optional(),
  address: z.string().trim().max(500, t("Alamat maksimal 500 karakter")).optional(),
  surface: z.enum(["natural", "artificial", "hybrid", "futsal"], t("Pilih permukaan lapangan")),
  capacity: optionalInt(0, 2_147_483_647, t("Kapasitas harus bilangan bulat positif atau nol")),
  fieldCount: requiredInt(1, 2_147_483_647, t("Jumlah lapangan minimal satu dan harus bilangan bulat")),
  floodlights: z.preprocess((value) => value === "on", z.boolean()),
  photoUrl: imageUrlField(t),
  notes: z.string().trim().max(2000, t("Catatan maksimal 2000 karakter")).optional(),
});
