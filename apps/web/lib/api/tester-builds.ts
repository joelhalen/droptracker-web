import { apiGet, withFallback } from "./_client";
import {
  AdminTesterBuildsSchema,
  TesterBuildsSchema,
  type AdminTesterBuilds,
  type TesterBuilds,
} from "@droptracker/api-types";
import { mockAdminTesterBuilds, mockTesterBuilds } from "../mock-data";

export const testerBuildsApi = {

  // --- Plugin test builds (/bug-testing, /admin/testers) ------------------
  /**
   * The current test build, the ones before it, and the caller's own
   * downloads. Bug Testers and staff only: everyone else gets a 403 whose
   * problem code is `bug_tester_required`, which the page turns into a notice.
   *
   * There is no download method here on purpose. Recording a download and
   * handing the file to nginx is one step, and it lives in the
   * /dl/bugtest.zip route handler so nothing else can record one by accident.
   */
  async testerBuilds(): Promise<TesterBuilds> {
    return withFallback(
      async () => TesterBuildsSchema.parse(await apiGet(`/tester-builds`, { authed: true })),
      () => mockTesterBuilds(),
    );
  },

  /** Build pipeline status, every build, and tester activity (developer or superadmin). */
  async adminTesterBuilds(): Promise<AdminTesterBuilds> {
    return withFallback(
      async () =>
        AdminTesterBuildsSchema.parse(await apiGet(`/admin/tester-builds`, { authed: true })),
      () => mockAdminTesterBuilds(),
    );
  },
};
