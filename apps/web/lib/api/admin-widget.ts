import { z } from "zod";
import { apiGet, apiSend, withFallback } from "./_client";

/** A phone paired to the owner's Android admin widget (web_api/routes/admin_widget.py). */
export const WidgetDeviceSchema = z.object({
  id: z.number(),
  label: z.string(),
  token_hint: z.string(),
  created_at: z.number().nullable(),
  last_used_at: z.number().nullable(),
  revoked_at: z.number().nullable(),
});
export type WidgetDevice = z.infer<typeof WidgetDeviceSchema>;

/** Pairing response: the raw token appears here once and is never readable again. */
export const PairedWidgetDeviceSchema = WidgetDeviceSchema.extend({
  token: z.string(),
  pair_url: z.string(),
});
export type PairedWidgetDevice = z.infer<typeof PairedWidgetDeviceSchema>;

export const adminWidgetApi = {
  async adminWidgetDevices(): Promise<WidgetDevice[]> {
    return withFallback(
      async () =>
        z
          .object({ tokens: WidgetDeviceSchema.array() })
          .parse(await apiGet(`/admin/widget-tokens`, { authed: true })).tokens,
      () => [],
    );
  },

  async adminPairWidgetDevice(label: string): Promise<PairedWidgetDevice> {
    return PairedWidgetDeviceSchema.parse(await apiSend("POST", `/admin/widget-tokens`, { label }));
  },

  async adminRevokeWidgetDevice(id: number): Promise<WidgetDevice> {
    return WidgetDeviceSchema.parse(await apiSend("DELETE", `/admin/widget-tokens/${id}`, {}));
  },
};
