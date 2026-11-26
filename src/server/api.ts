import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma } from "@prisma/client";
import { can, type Permission } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "./session";

import { AppErrorLite } from "./errors";

/** Lỗi nghiệp vụ có mã HTTP rõ ràng */
export const AppError = AppErrorLite;

export const notFound = (what = "Dữ liệu") => new AppError(404, `${what} không tồn tại hoặc bạn không có quyền truy cập`);
export const forbidden = (msg = "Bạn không có quyền thực hiện thao tác này") => new AppError(403, msg);
export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, details);

type Ctx<P> = { req: NextRequest; user: CurrentUser; params: P };

/**
 * Bọc route handler: xác thực, kiểm tra quyền, chuẩn hóa lỗi.
 */
export function handler<P = Record<string, string>>(
  fn: (ctx: Ctx<P>) => Promise<unknown>,
  opts: { perm?: Permission } = {},
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new AppError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
      if (opts.perm && !can(user.role, opts.perm)) throw forbidden();
      const params = context?.params ? await context.params : ({} as P);
      const result = await fn({ req, user, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export function toErrorResponse(e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const details = e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ: " + details.map((d) => d.message).join("; "), details },
      { status: 400 },
    );
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const target = (e.meta?.target as string[] | undefined)?.join(", ");
      return NextResponse.json({ error: `Giá trị đã tồn tại (trùng ${target ?? "khóa"})` }, { status: 409 });
    }
    if (e.code === "P2003") {
      return NextResponse.json(
        { error: "Không thể xóa/cập nhật vì dữ liệu đang được sử dụng ở nơi khác. Hãy vô hiệu hóa thay vì xóa." },
        { status: 409 },
      );
    }
    if (e.code === "P2025") return NextResponse.json({ error: "Không tìm thấy dữ liệu" }, { status: 404 });
  }
  console.error("[API ERROR]", e);
  return NextResponse.json({ error: "Lỗi hệ thống, vui lòng thử lại sau" }, { status: 500 });
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Dữ liệu gửi lên không đúng định dạng JSON");
  }
  return schema.parse(json);
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}
