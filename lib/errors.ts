/**
 * lib/errors.ts
 * Typed error hierarchy for ScanBrain.
 * Every route handler catches AppError and calls .toResponse() so we have
 * a single consistent error shape: { error: string, code: string }.
 */

import { NextResponse } from "next/server";

export interface ErrorBody {
  error: string;
  code: string;
}

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly status: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }

  toResponse(): NextResponse<ErrorBody> {
    return NextResponse.json(
      { error: this.message, code: this.code },
      { status: this.status }
    );
  }

  /** Wrap any unknown thrown value into an AppError. */
  static from(err: unknown): AppError {
    if (err instanceof AppError) return err;
    const msg = err instanceof Error ? err.message : String(err);
    return new AppError(msg, "INTERNAL_ERROR", 500);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class FileTooLargeError extends AppError {
  constructor(filename: string, maxMb: number) {
    super(
      `File "${filename}" exceeds the ${maxMb} MB limit.`,
      "FILE_TOO_LARGE",
      413
    );
    this.name = "FileTooLargeError";
  }
}

export class UnsupportedFileTypeError extends AppError {
  constructor(filename: string) {
    super(
      `File "${filename}" has an unsupported type. Allowed: PDF, PNG, JPEG, WEBP, TXT, CSV.`,
      "UNSUPPORTED_FILE_TYPE",
      415
    );
    this.name = "UnsupportedFileTypeError";
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super(
      "Too many requests. Please wait a moment and try again.",
      "RATE_LIMITED",
      429
    );
    this.name = "RateLimitError";
  }
}

export class UpstreamError extends AppError {
  constructor(service: string, cause?: string) {
    super(
      `Upstream service error (${service})${cause ? `: ${cause}` : ""}.`,
      "UPSTREAM_ERROR",
      502
    );
    this.name = "UpstreamError";
  }
}
