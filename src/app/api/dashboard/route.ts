import { handler } from "@/server/api";
import { dashboard, filterSchema } from "@/server/analytics";

export const GET = handler(async ({ req, user }) => dashboard(user, filterSchema.parse(Object.fromEntries(req.nextUrl.searchParams))));
