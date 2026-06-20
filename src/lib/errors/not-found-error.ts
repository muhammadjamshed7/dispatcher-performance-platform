import { AppError } from "@/lib/errors/app-error";

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}
