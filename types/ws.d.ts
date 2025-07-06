declare module 'ws' {
    export class WebSocket extends EventTarget {
        constructor(url: string, protocols?: string | string[]);
        on(event: string, listener: (...args: any[]) => void): this;
        send(data: string | Buffer | ArrayBuffer | Buffer[]): void;
        close(code?: number, data?: string): void;
    }
}
