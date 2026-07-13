export type AssessmentErrorCode =
  | "CONFIGURATION_ERROR"
  | "INVALID_REQUEST"
  | "MODEL_REFUSAL"
  | "MODEL_INCOMPLETE"
  | "MODEL_OUTPUT_INVALID"
  | "UPSTREAM_AUTHENTICATION_ERROR"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "REQUEST_ABORTED";

export class AssessmentError extends Error {
  readonly code: AssessmentErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(options: {
    code: AssessmentErrorCode;
    message: string;
    httpStatus: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "AssessmentError";
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function isAssessmentError(error: unknown): error is AssessmentError {
  return error instanceof AssessmentError;
}

