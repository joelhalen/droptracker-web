import { apiGet, apiSend, apiSendForm, withFallback } from "./_client";
import {
  FileTransferSchema,
  FileTransferPageSchema,
  type FileTransfer,
  type FileTransferPage,
} from "@droptracker/api-types";
import { mockFileTransfers } from "../mock-data";

export const fileTransfersApi = {

  // --- File transfers (web95a, unlisted /file-transfer page) --------------
  /**
   * The caller's own transfers, newest first, each with every version.
   *
   * The 25 MB cap and 30-day retention come back in the payload rather than
   * being restated here — the browser's pre-flight size check and the copy on
   * the page both read them, so they can't drift from what the API enforces.
   */
  async myFileTransfers(params: { page?: number; limit?: number } = {}): Promise<FileTransferPage> {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        FileTransferPageSchema.parse(await apiGet(`/file-transfers${suffix}`, { authed: true })),
      () => mockFileTransfers(),
    );
  },

  /** Start a transfer (multipart 'file', optional 'note'); stores version 1. */
  async createFileTransfer(form: FormData): Promise<FileTransfer> {
    return withFallback(
      async () => FileTransferSchema.parse(await apiSendForm("POST", "/file-transfers", form)),
      () => mockFileTransfers().items[0]!,
    );
  },

  /** Every user's transfers (developer or superadmin). */
  async adminFileTransfers(
    params: { page?: number; limit?: number } = {},
  ): Promise<FileTransferPage> {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        FileTransferPageSchema.parse(
          await apiGet(`/admin/file-transfers${suffix}`, { authed: true }),
        ),
      () => mockFileTransfers(),
    );
  },

  /** Staff reply: store an updated copy as the transfer's next version. */
  async addFileTransferVersion(transferId: number, form: FormData): Promise<FileTransfer> {
    return withFallback(
      async () =>
        FileTransferSchema.parse(
          await apiSendForm("POST", `/admin/file-transfers/${transferId}/versions`, form),
        ),
      () => mockFileTransfers().items[0]!,
    );
  },

  /** Staff: drop a transfer and every version's stored object. */
  async deleteFileTransfer(transferId: number): Promise<void> {
    await withFallback(
      async () => {
        await apiSend("DELETE", `/admin/file-transfers/${transferId}`, {});
      },
      () => undefined,
    );
  },
};
