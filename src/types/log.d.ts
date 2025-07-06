declare module 'log' {
    const log: {
        level: number;
        prefix: string;
        debug: (...args: any[]) => void;
        info: (...args: any[]) => void;
        error: (...args: any[]) => void;
        DEBUG: number;
        INFO: number;
        ERROR: number;
    };
    export default log;
}
