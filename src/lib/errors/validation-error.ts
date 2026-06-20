import { AppError } from "@/lib/errors/app-error";

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
