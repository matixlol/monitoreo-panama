import { defineApp } from "convex/server";
import tableHistory from "convex-table-history/convex.config";

const app = defineApp();

// One TableHistory component instance per table we want to audit.
app.use(tableHistory, { name: "documentsHistory" });
app.use(tableHistory, { name: "extractionsHistory" });
app.use(tableHistory, { name: "summaryExtractionsHistory" });
app.use(tableHistory, { name: "validatedDataHistory" });

export default app;

