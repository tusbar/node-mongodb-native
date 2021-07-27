import type { TopologyVersion } from './sdam/server_description';
import type { Document } from './bson';
import type { TopologyDescription } from './sdam/topology_description';

/** @public */
export type AnyError = MongoError | Error;

/** @internal */
const kErrorLabels = Symbol('errorLabels');

/** @internal MongoDB Error Codes */
export const MONGODB_ERROR_CODES = Object.freeze({
  HostUnreachable: 6,
  HostNotFound: 7,
  NetworkTimeout: 89,
  ShutdownInProgress: 91,
  PrimarySteppedDown: 189,
  ExceededTimeLimit: 262,
  SocketException: 9001,
  NotMaster: 10107,
  InterruptedAtShutdown: 11600,
  InterruptedDueToReplStateChange: 11602,
  NotMasterNoSlaveOk: 13435,
  NotMasterOrSecondary: 13436,
  StaleShardVersion: 63,
  StaleEpoch: 150,
  StaleConfig: 13388,
  RetryChangeStream: 234,
  FailedToSatisfyReadPreference: 133,
  CursorNotFound: 43,
  LegacyNotPrimary: 10058,
  WriteConcernFailed: 64,
  NamespaceNotFound: 26,
  IllegalOperation: 20,
  MaxTimeMSExpired: 50,
  UnknownReplWriteConcern: 79,
  UnsatisfiableWriteConcern: 100
} as const);

// From spec@https://github.com/mongodb/specifications/blob/f93d78191f3db2898a59013a7ed5650352ef6da8/source/change-streams/change-streams.rst#resumable-error
export const GET_MORE_RESUMABLE_CODES = new Set<number>([
  MONGODB_ERROR_CODES.HostUnreachable,
  MONGODB_ERROR_CODES.HostNotFound,
  MONGODB_ERROR_CODES.NetworkTimeout,
  MONGODB_ERROR_CODES.ShutdownInProgress,
  MONGODB_ERROR_CODES.PrimarySteppedDown,
  MONGODB_ERROR_CODES.ExceededTimeLimit,
  MONGODB_ERROR_CODES.SocketException,
  MONGODB_ERROR_CODES.NotMaster,
  MONGODB_ERROR_CODES.InterruptedAtShutdown,
  MONGODB_ERROR_CODES.InterruptedDueToReplStateChange,
  MONGODB_ERROR_CODES.NotMasterNoSlaveOk,
  MONGODB_ERROR_CODES.NotMasterOrSecondary,
  MONGODB_ERROR_CODES.StaleShardVersion,
  MONGODB_ERROR_CODES.StaleEpoch,
  MONGODB_ERROR_CODES.StaleConfig,
  MONGODB_ERROR_CODES.RetryChangeStream,
  MONGODB_ERROR_CODES.FailedToSatisfyReadPreference,
  MONGODB_ERROR_CODES.CursorNotFound
]);

/** @public */
export interface ErrorDescription {
  message?: string;
  errmsg?: string;
  $err?: string;
  errorLabels?: string[];
  [key: string]: any;
}

/**
 * @public
 * @category Error
 *
 * @privateRemarks
 * CSFLE has a dependency on this error, it uses the constructor with a string argument
 */
export class MongoError extends Error {
  /** @internal */
  [kErrorLabels]: Set<string>;
  code?: number | string;
  topologyVersion?: TopologyVersion;

  constructor(message: string | Error) {
    if (message instanceof Error) {
      super(message.message);
      this.stack = message.stack;
    } else {
      super(message);
    }
  }

  get name(): string {
    return 'MongoError';
  }

  /** Legacy name for server error responses */
  get errmsg(): string {
    return this.message;
  }

  /**
   * Checks the error to see if it has an error label
   *
   * @param label - The error label to check for
   * @returns returns true if the error has the provided error label
   */
  hasErrorLabel(label: string): boolean {
    if (this[kErrorLabels] == null) {
      return false;
    }

    return this[kErrorLabels].has(label);
  }

  addErrorLabel(label: string): void {
    if (this[kErrorLabels] == null) {
      this[kErrorLabels] = new Set();
    }

    this[kErrorLabels].add(label);
  }

  get errorLabels(): string[] {
    return this[kErrorLabels] ? Array.from(this[kErrorLabels]) : [];
  }
}

/**
 * An error coming from the mongo server
 *
 * @public
 * @category Error
 */
export class MongoServerError extends MongoError {
  code?: number;
  codeName?: string;
  writeConcernError?: Document;

  constructor(message: Error | ErrorDescription) {
    if (message instanceof Error) {
      super(message);
    } else {
      super(message.message || message.errmsg || message.$err || 'n/a');
      if (message.errorLabels) {
        this[kErrorLabels] = new Set(message.errorLabels);
      }

      for (const name in message) {
        if (name === 'errorLabels' || name === 'errmsg' || name === 'message') {
          continue;
        }

        (this as any)[name] = message[name];
      }
    }
  }

  get name(): string {
    return 'MongoServerError';
  }
}

/**
 * An error generated by the driver
 *
 * @public
 * @category Error
 */
export class MongoDriverError extends MongoError {
  code?: string;
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoDriverError';
  }
}

/**
 * An error generated when the driver encounters unexpected input
 * or reaches an unexpected/invalid internal state
 *
 * @privateRemarks
 * Should **never** be directly instantiated.
 *
 * @public
 * @category Error
 */
export class MongoRuntimeError extends MongoDriverError {
  protected constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoRuntimeError';
  }
}

/**
 * An error generated when a batch command is reexecuted after one of the commands in the batch
 * has failed
 *
 * @public
 * @category Error
 */
export class MongoBatchReExecutionError extends MongoRuntimeError {
  constructor(message?: string) {
    super(message || 'This batch has already been executed, create new batch to execute');
  }

  get name(): string {
    return 'MongoBatchReExecutionError';
  }
}

/**
 * An error generated when the user supplies an incorrect URI to the driver.
 *
 * @public
 * @category Error
 */
export class MongoURIError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoURIError';
  }
}

/**
 * An error generated when the driver fails to compress data
 * before sending it to the server.
 *
 * @public
 * @category Error
 */
export class MongoCompressionError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoCompressionError';
  }
}

/**
 * An error generated when the driver fails to decompress
 * data received from the server.
 *
 * @public
 * @category Error
 */
export class MongoDecompressionError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoDecompressionError';
  }
}

/**
 * An error thrown when the user attempts to operate on a database or collection through a MongoClient
 * that has not yet successfully called the "connect" method
 *
 * @public
 * @category Error
 */
export class MongoNotConnectedError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoNotConnectedError';
  }
}

/**
 * An error generated when the user makes a mistake in the usage of transactions.
 * (e.g. attempting to commit a transaction with a readPreference other than primary)
 *
 * @public
 * @category Error
 */
export class MongoTransactionError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoTransactionError';
  }
}

/**
 * An error generated when the user attempts to operate
 * on a session that has expired or has been closed.
 *
 * @public
 * @category Error
 */
export class MongoExpiredSessionError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoExpiredSessionError';
  }
}

/**
 * A error generated when the user attempts to authenticate
 * via Kerberos, but fails to connect to the Kerberos client.
 *
 * @public
 * @category Error
 */
export class MongoKerberosError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoKerberosError';
  }
}

/**
 * An error thrown when the user attempts to operate on a cursor that is in a state which does not
 * support the attempted operation.
 *
 * @public
 * @category Error
 */
export class MongoCursorError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoCursorError';
  }
}

/**
 * An error generated when a stream operation fails to execute.
 *
 * @public
 * @category Error
 */
export class MongoStreamError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoStreamError';
  }
}

/**
 * An error generated when a ChangeStream operation fails to execute.
 *
 * @public
 * @category Error
 */
export class MongoChangeStreamError extends MongoStreamError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoChangeStreamError';
  }
}

/**
 * An error thrown when the user calls a function or method not supported on a tailable cursor
 *
 * @public
 * @category Error
 */
export class MongoTailableCursorError extends MongoCursorError {
  constructor(message?: string) {
    super(message || 'Tailable cursor does not support this operation');
  }

  get name(): string {
    return 'MongoTailableCursorError';
  }
}

/** An error generated when a GridFSStream operation fails to execute.
 *
 * @public
 * @category Error
 */
export class MongoGridFSStreamError extends MongoStreamError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoGridFSStreamError';
  }
}

/**
 * An error generated when a malformed or invalid chunk is
 * encountered when reading from a GridFSStream.
 *
 * @public
 * @category Error
 */
export class MongoGridFSChunkError extends MongoStreamError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoGridFSChunkError';
  }
}

/**
 * An error thrown when the user attempts to add options to a cursor that has already been
 * initialized
 *
 * @public
 * @category Error
 */
export class MongoCursorInUseError extends MongoCursorError {
  constructor(message?: string) {
    super(message || 'Cursor is already initialized');
  }

  get name(): string {
    return 'MongoCursorInUseError';
  }
}

/**
 * An error generated when an attempt is made to access a resource
 * which has already been or will be closed/destroyed.
 *
 * @public
 * @category Error
 */
export class MongoResourceClosedError extends MongoRuntimeError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoResourceClosedError';
  }
}

/**
 * An error generated when an attempt is made to operate
 * on a closed/closing server.
 *
 * @public
 * @category Error
 */
export class MongoServerClosedError extends MongoResourceClosedError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoServerClosedError';
  }
}

/**
 * An error thrown when an attempt is made to read from a cursor that has been exhausted
 *
 * @public
 * @category Error
 */
export class MongoCursorExhaustedError extends MongoCursorError {
  constructor(message?: string) {
    super(message || 'Cursor is exhausted');
  }

  get name(): string {
    return 'MongoCursorExhaustedError';
  }
}

/**
 * An error generated when an attempt is made to operate
 * on a closed/closing stream.
 *
 * @public
 * @category Error
 */
export class MongoStreamClosedError extends MongoResourceClosedError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoStreamClosedError';
  }
}

/**
 * An error generated when an attempt is made to operate on a
 * dropped, or otherwise unavailable, database.
 *
 * @public
 * @category Error
 */
export class MongoTopologyClosedError extends MongoResourceClosedError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoTopologyClosedError';
  }
}

/** @internal */
const kBeforeHandshake = Symbol('beforeHandshake');
export function isNetworkErrorBeforeHandshake(err: MongoNetworkError): boolean {
  return err[kBeforeHandshake] === true;
}

/**
 * An error indicating an issue with the network, including TCP errors and timeouts.
 * @public
 * @category Error
 */
export class MongoNetworkError extends MongoError {
  /** @internal */
  [kBeforeHandshake]?: boolean;

  constructor(message: string | Error, options?: { beforeHandshake?: boolean }) {
    super(message);

    if (options && typeof options.beforeHandshake === 'boolean') {
      this[kBeforeHandshake] = options.beforeHandshake;
    }
  }

  get name(): string {
    return 'MongoNetworkError';
  }
}

/** @public */
export interface MongoNetworkTimeoutErrorOptions {
  /** Indicates the timeout happened before a connection handshake completed */
  beforeHandshake: boolean;
}

/**
 * An error indicating a network timeout occurred
 * @public
 * @category Error
 *
 * @privateRemarks
 * CSFLE has a dependency on this error with an instanceof check
 */
export class MongoNetworkTimeoutError extends MongoNetworkError {
  constructor(message: string, options?: MongoNetworkTimeoutErrorOptions) {
    super(message, options);
  }

  get name(): string {
    return 'MongoNetworkTimeoutError';
  }
}

/**
 * An error used when attempting to parse a value (like a connection string)
 * @public
 * @category Error
 */
export class MongoParseError extends MongoDriverError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoParseError';
  }
}

/**
 * An error generated when the driver API is used incorrectly
 *
 * @privateRemarks
 * Should **never** be directly instantiated
 *
 * @public
 * @category Error
 */

export class MongoAPIError extends MongoDriverError {
  protected constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoAPIError';
  }
}

/**
 * An error generated when the user supplies malformed or unexpected arguments
 * or when a required argument or field is not provided.
 *
 *
 * @public
 * @category Error
 */
export class MongoInvalidArgumentError extends MongoAPIError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoInvalidArgumentError';
  }
}

/**
 * An error generated when a feature that is not enabled or allowed for the current server
 * configuration is used
 *
 *
 * @public
 * @category Error
 */
export class MongoCompatibilityError extends MongoAPIError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoCompatibilityError';
  }
}

/**
 * An error generated when the user fails to provide authentication credentials before attempting
 * to connect to a mongo server instance.
 *
 *
 * @public
 * @category Error
 */
export class MongoMissingCredentialsError extends MongoAPIError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoMissingCredentialsError';
  }
}

/**
 * An error generated when a required module or dependency is not present in the local environment
 *
 * @public
 * @category Error
 */
export class MongoMissingDependencyError extends MongoAPIError {
  constructor(message: string) {
    super(message);
  }

  get name(): string {
    return 'MongoMissingDependencyError';
  }
}
/**
 * An error signifying a general system issue
 * @public
 * @category Error
 */
export class MongoSystemError extends MongoError {
  /** An optional reason context, such as an error saved during flow of monitoring and selecting servers */
  reason?: TopologyDescription;

  constructor(message: string, reason: TopologyDescription) {
    if (reason && reason.error) {
      super(reason.error.message || reason.error);
    } else {
      super(message);
    }

    if (reason) {
      this.reason = reason;
    }
  }

  get name(): string {
    return 'MongoSystemError';
  }
}

/**
 * An error signifying a client-side server selection error
 * @public
 * @category Error
 */
export class MongoServerSelectionError extends MongoSystemError {
  constructor(message: string, reason: TopologyDescription) {
    super(message, reason);
  }

  get name(): string {
    return 'MongoServerSelectionError';
  }
}

function makeWriteConcernResultObject(input: any) {
  const output = Object.assign({}, input);

  if (output.ok === 0) {
    output.ok = 1;
    delete output.errmsg;
    delete output.code;
    delete output.codeName;
  }

  return output;
}

/**
 * An error thrown when the server reports a writeConcernError
 * @public
 * @category Error
 */
export class MongoWriteConcernError extends MongoServerError {
  /** The result document (provided if ok: 1) */
  result?: Document;

  constructor(message: ErrorDescription, result: Document) {
    if (result && Array.isArray(result.errorLabels)) {
      message.errorLabels = result.errorLabels;
    }

    super(message);

    if (result != null) {
      this.result = makeWriteConcernResultObject(result);
    }
  }

  get name(): string {
    return 'MongoWriteConcernError';
  }
}

// see: https://github.com/mongodb/specifications/blob/master/source/retryable-writes/retryable-writes.rst#terms
const RETRYABLE_ERROR_CODES = new Set<number>([
  MONGODB_ERROR_CODES.HostUnreachable,
  MONGODB_ERROR_CODES.HostNotFound,
  MONGODB_ERROR_CODES.NetworkTimeout,
  MONGODB_ERROR_CODES.ShutdownInProgress,
  MONGODB_ERROR_CODES.PrimarySteppedDown,
  MONGODB_ERROR_CODES.SocketException,
  MONGODB_ERROR_CODES.NotMaster,
  MONGODB_ERROR_CODES.InterruptedAtShutdown,
  MONGODB_ERROR_CODES.InterruptedDueToReplStateChange,
  MONGODB_ERROR_CODES.NotMasterNoSlaveOk,
  MONGODB_ERROR_CODES.NotMasterOrSecondary
]);

const RETRYABLE_WRITE_ERROR_CODES = new Set<number>([
  MONGODB_ERROR_CODES.InterruptedAtShutdown,
  MONGODB_ERROR_CODES.InterruptedDueToReplStateChange,
  MONGODB_ERROR_CODES.NotMaster,
  MONGODB_ERROR_CODES.NotMasterNoSlaveOk,
  MONGODB_ERROR_CODES.NotMasterOrSecondary,
  MONGODB_ERROR_CODES.PrimarySteppedDown,
  MONGODB_ERROR_CODES.ShutdownInProgress,
  MONGODB_ERROR_CODES.HostNotFound,
  MONGODB_ERROR_CODES.HostUnreachable,
  MONGODB_ERROR_CODES.NetworkTimeout,
  MONGODB_ERROR_CODES.SocketException,
  MONGODB_ERROR_CODES.ExceededTimeLimit
]);

export function isRetryableWriteError(error: MongoError): boolean {
  if (error instanceof MongoWriteConcernError) {
    return RETRYABLE_WRITE_ERROR_CODES.has(error.result?.code ?? error.code ?? 0);
  }
  return typeof error.code === 'number' && RETRYABLE_WRITE_ERROR_CODES.has(error.code);
}

/** Determines whether an error is something the driver should attempt to retry */
export function isRetryableError(error: MongoError): boolean {
  return (
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (typeof error.code === 'number' && RETRYABLE_ERROR_CODES.has(error.code!)) ||
    error instanceof MongoNetworkError ||
    !!error.message.match(/not master/) ||
    !!error.message.match(/node is recovering/)
  );
}

const SDAM_RECOVERING_CODES = new Set<number>([
  MONGODB_ERROR_CODES.ShutdownInProgress,
  MONGODB_ERROR_CODES.PrimarySteppedDown,
  MONGODB_ERROR_CODES.InterruptedAtShutdown,
  MONGODB_ERROR_CODES.InterruptedDueToReplStateChange,
  MONGODB_ERROR_CODES.NotMasterOrSecondary
]);

const SDAM_NOTMASTER_CODES = new Set<number>([
  MONGODB_ERROR_CODES.NotMaster,
  MONGODB_ERROR_CODES.NotMasterNoSlaveOk,
  MONGODB_ERROR_CODES.LegacyNotPrimary
]);

const SDAM_NODE_SHUTTING_DOWN_ERROR_CODES = new Set<number>([
  MONGODB_ERROR_CODES.InterruptedAtShutdown,
  MONGODB_ERROR_CODES.ShutdownInProgress
]);

function isRecoveringError(err: MongoError) {
  if (typeof err.code === 'number') {
    // If any error code exists, we ignore the error.message
    return SDAM_RECOVERING_CODES.has(err.code);
  }

  return /not master or secondary/.test(err.message) || /node is recovering/.test(err.message);
}

function isNotMasterError(err: MongoError) {
  if (typeof err.code === 'number') {
    // If any error code exists, we ignore the error.message
    return SDAM_NOTMASTER_CODES.has(err.code);
  }

  if (isRecoveringError(err)) {
    return false;
  }

  return /not master/.test(err.message);
}

export function isNodeShuttingDownError(err: MongoError): boolean {
  return !!(typeof err.code === 'number' && SDAM_NODE_SHUTTING_DOWN_ERROR_CODES.has(err.code));
}

/**
 * Determines whether SDAM can recover from a given error. If it cannot
 * then the pool will be cleared, and server state will completely reset
 * locally.
 *
 * @see https://github.com/mongodb/specifications/blob/master/source/server-discovery-and-monitoring/server-discovery-and-monitoring.rst#not-master-and-node-is-recovering
 */
export function isSDAMUnrecoverableError(error: MongoError): boolean {
  // NOTE: null check is here for a strictly pre-CMAP world, a timeout or
  //       close event are considered unrecoverable
  if (error instanceof MongoParseError || error == null) {
    return true;
  }

  return isRecoveringError(error) || isNotMasterError(error);
}

export function isNetworkTimeoutError(err: MongoError): err is MongoNetworkError {
  return !!(err instanceof MongoNetworkError && err.message.match(/timed out/));
}

// From spec@https://github.com/mongodb/specifications/blob/7a2e93d85935ee4b1046a8d2ad3514c657dc74fa/source/change-streams/change-streams.rst#resumable-error:
//
// An error is considered resumable if it meets any of the following criteria:
// - any error encountered which is not a server error (e.g. a timeout error or network error)
// - any server error response from a getMore command excluding those containing the error label
//   NonRetryableChangeStreamError and those containing the following error codes:
//   - Interrupted: 11601
//   - CappedPositionLost: 136
//   - CursorKilled: 237
//
// An error on an aggregate command is not a resumable error. Only errors on a getMore command may be considered resumable errors.

export function isResumableError(error?: MongoError, wireVersion?: number): boolean {
  if (error instanceof MongoNetworkError) {
    return true;
  }

  if (typeof wireVersion !== 'undefined' && wireVersion >= 9) {
    // DRIVERS-1308: For 4.4 drivers running against 4.4 servers, drivers will add a special case to treat the CursorNotFound error code as resumable
    if (error && error instanceof MongoError && error.code === 43) {
      return true;
    }
    return error instanceof MongoError && error.hasErrorLabel('ResumableChangeStreamError');
  }

  if (error && typeof error.code === 'number') {
    return GET_MORE_RESUMABLE_CODES.has(error.code);
  }
  return false;
}
