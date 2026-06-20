import "server-only";

import { getPublicEnv, getServerEnv } from "@/lib/env";

export function getAppConfig() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return {
    appName: publicEnv.NEXT_PUBLIC_APP_NAME,
    appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
    defaultTimezone: serverEnv.DEFAULT_TIMEZONE,
    defaultCurrency: serverEnv.DEFAULT_CURRENCY,
    reportExportMaxRows: serverEnv.REPORT_EXPORT_MAX_ROWS,
    reportExportStorageBucket: serverEnv.REPORT_EXPORT_STORAGE_BUCKET,
  };
}

export const appConfig = getAppConfig();
