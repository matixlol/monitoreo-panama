import { defineApp } from "convex/server";
import actionRetrier from "@convex-dev/action-retrier/convex.config.js";
import tableHistory from "convex-table-history/convex.config";

const app = defineApp();

app.use(actionRetrier);

// One TableHistory component instance per table we want to audit.
app.use(tableHistory, { name: "documentsHistory" });
app.use(tableHistory, { name: "extractionsHistory" });
app.use(tableHistory, { name: "summaryExtractionsHistory" });
app.use(tableHistory, { name: "validatedDataHistory" });

export default app;
