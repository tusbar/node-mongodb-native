import type { Document } from '../../bson';
import type { Connection, ConnectionOptions } from '../connection';
import type { MongoCredentials } from './mongo_credentials';
import type { HandshakeDocument } from '../connect';
import type { ClientMetadataOptions, Callback } from '../../utils';
import { MongoDriverError } from '../../error';

export type AuthContextOptions = ConnectionOptions & ClientMetadataOptions;

/** Context used during authentication */
export class AuthContext {
  /** The connection to authenticate */
  connection: Connection;
  /** The credentials to use for authentication */
  credentials?: MongoCredentials;
  /** The options passed to the `connect` method */
  options: AuthContextOptions;

  /** A response from an initial auth attempt, only some mechanisms use this (e.g, SCRAM) */
  response?: Document;
  /** A random nonce generated for use in an authentication conversation */
  nonce?: Buffer;

  constructor(
    connection: Connection,
    credentials: MongoCredentials | undefined,
    options: AuthContextOptions
  ) {
    this.connection = connection;
    this.credentials = credentials;
    this.options = options;
  }
}

export class AuthProvider {
  /**
   * Prepare the handshake document before the initial handshake.
   *
   * @param handshakeDoc - The document used for the initial handshake on a connection
   * @param authContext - Context for authentication flow
   */
  prepare(
    handshakeDoc: HandshakeDocument,
    authContext: AuthContext,
    callback: Callback<HandshakeDocument>
  ): void {
    callback(undefined, handshakeDoc);
  }

  /**
   * Authenticate
   *
   * @param context - A shared context for authentication flow
   * @param callback - The callback to return the result from the authentication
   */
  auth(context: AuthContext, callback: Callback): void {
    // TODO(NODE-3485): Replace this with MongoMethodOverrideError
    callback(new MongoDriverError('`auth` method must be overridden by subclass'));
  }
}
