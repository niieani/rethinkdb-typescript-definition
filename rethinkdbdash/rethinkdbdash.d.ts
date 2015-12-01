/// <reference path="../node/node.d.ts" />
/// <reference path="../bluebird/bluebird.d.ts" />
/// <reference path="../rethinkdb/rethinkdb.d.ts" />

declare module "rethinkdbdash" {
  import * as events from 'events';
  
  class PoolMaster extends events.EventEmitter {
      constructor(r: any, options: any);
      emitStatus(): void;
      drain(): Promise<void>;
      getAvailableLength(): any;
      getLength(): any;
      resetBufferParameters(): void;
      getNumAvailableConnections(): number;
      getNumConnections(): number;
      initPool(pool: any): void;
      fetchServers(useSeeds?: any): void;
      deletePool(key: any): void;
      createPool(server: any): void;
      createPoolSettings(globalOptions: any, serverOptions: any, log: any): any;
      handleAllServersResponse(servers: any): void;
      getConnection(): any;
      getPools(): any[];
  }
  
  class Pool extends events.EventEmitter {
    id: any;
    options: any;
    timeoutReconnect: any;
    constructor(r: any, options: any);
    getAddress(): string;
    drain(): Promise<void>;
    drainLocalhost(): void;
    setOptions(options: any): any;
    getAvailableLength(): any;
    getLength(): any;
    createConnection(): Promise<Connection>;
    putConnection(connection: Connection): void;
    getConnection(): Promise<Connection>;
  }
  
  class Connection extends events.EventEmitter {
    rejectMap: any;
    timeout: any;
    open: any;
    metadata: any;
    buffer: any;
    token: any;
    db: any;
    timeoutConnect: any;
    authKey: any;
    port: any;
    host: any;
    r: any;
    connection: any;
    timeoutOpen: any;
    constructor(r: any, options: any, resolve: any, reject: any);
    noreplyWait(callback?: (err: any, value?: any) => void): Promise<any>;
    noReplyWait(): void;
    close(options?: any, callback?: (err: any, value?: any) => void): Promise<any>;
    server(callback: any): void;
    use(db: any): void;
    reconnect(options: any, callback?: (err: any, value?: any) => void): any;
  }

  interface rethinkdbdash extends rethinkdb.RInterface {
    getPoolMaster(): PoolMaster;
    getPool(i: number): Pool;
    createPools(options?: any): rethinkdbdash;
    setArrayLimit(arrayLimit: number): void;
    setNestingLevel(nestingLevel: number): void;
  }
  
  function r(options?:{ 
    port?:number, 
    host?:string, 
    db?:string, 
    discovery?:boolean, 
    max?:number, 
    buffer?:number, 
    timeout?:number, 
    timeoutError?:number, 
    timeoutGb?:number, 
    maxExponent?:number, 
    silent?:boolean, 
    servers?:Array<{host:string, port:number}>, 
    optionalRun?:boolean, 
    ssl?:boolean, 
    pool?:boolean, 
    cursor?:boolean 
  }):rethinkdbdash;
  
  export = r;
}