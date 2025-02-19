import { CommandOperation, CommandOperationOptions } from './command';
import type { Callback } from '../utils';
import type { Document } from '../bson';
import type { Server } from '../sdam/server';
import type { Admin } from '../admin';
import type { ClientSession } from '../sessions';
import { MongoDriverError } from '../error';

/** @public */
export interface ValidateCollectionOptions extends CommandOperationOptions {
  /** Validates a collection in the background, without interrupting read or write traffic (only in MongoDB 4.4+) */
  background?: boolean;
}

/** @internal */
export class ValidateCollectionOperation extends CommandOperation<Document> {
  options: ValidateCollectionOptions;
  collectionName: string;
  command: Document;

  constructor(admin: Admin, collectionName: string, options: ValidateCollectionOptions) {
    // Decorate command with extra options
    const command: Document = { validate: collectionName };
    const keys = Object.keys(options);
    for (let i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(options, keys[i]) && keys[i] !== 'session') {
        command[keys[i]] = (options as Document)[keys[i]];
      }
    }

    super(admin.s.db, options);
    this.options = options;
    this.command = command;
    this.collectionName = collectionName;
  }

  execute(server: Server, session: ClientSession, callback: Callback<Document>): void {
    const collectionName = this.collectionName;

    super.executeCommand(server, session, this.command, (err, doc) => {
      if (err != null) return callback(err);

      // TODO(NODE-3483): Replace these with MongoUnexpectedServerResponseError
      if (doc.ok === 0) return callback(new MongoDriverError('Error with validate command'));
      if (doc.result != null && typeof doc.result !== 'string')
        return callback(new MongoDriverError('Error with validation data'));
      if (doc.result != null && doc.result.match(/exception|corrupt/) != null)
        return callback(new MongoDriverError(`Invalid collection ${collectionName}`));
      if (doc.valid != null && !doc.valid)
        return callback(new MongoDriverError(`Invalid collection ${collectionName}`));

      return callback(undefined, doc);
    });
  }
}
