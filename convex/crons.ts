import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("council queued review", { minutes: 10 }, internal.actions.processNextQueuedReview, {});
crons.interval("slopbot daily highlight", { hours: 24 }, internal.slopbotDailyHighlight.tweetDailyHighlight, {});
export default crons;
