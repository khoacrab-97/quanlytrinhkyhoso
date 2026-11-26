/** Lỗi nghiệp vụ dùng được cả ngoài Next (seed, script). api.ts chuyển thành HTTP response. */
export class AppErrorLite extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}
