import { handler } from "@/server/api";
import { errorAnalytics, filterSchema } from "@/server/analytics";

export const GET = handler(async ({ req, user }) => errorAnalytics(user, filterSchema.parse(Object.fromEntries(req.nextUrl.searchParams))));
