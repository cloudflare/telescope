export enum TestStatus {
    PENDING = 0,
    SCHEDULED = 1,
    RUNNING = 2,
    COMPLETED = 3,
    ABORTED = 4,
    FAILED = 5,
    TIMED_OUT = 6,
    CANCELLED = 7,
}

export enum TestSource {
    BASIC = 'basic',
    ADVANCED = 'advanced',
    UPLOAD = 'upload',
    API = 'api',
    CLI = 'cli',
    AGENT = 'agent',
    UNKNOWN = 'unknown',
}

export class TestConfig {
    test_id: string;
    url?: string;
    browser?: string;
    source?: TestSource | TestSource.UNKNOWN;
    name?: string | null;
    description?: string | null;
    owner?: string | null; // user id or email
    cli_command?: string | null;
    device?: string | null;
    status?: TestStatus | null = TestStatus.PENDING;
    created_at: number = Math.floor(Date.now() / 1000);
    // all the cli options for the test, these would be overrides of the default options
    headers?: string | null;
    cookies?: string | null;
    flags?: string | null;
    block_domains?: string | null;
    block?: string | null;
    firefox_prefs?: string | null;
    cpu_throttle?: number | null;
    connection_type?: string | null;
    width?: number | null;
    height?: number | null;
    frame_rate?: number | null;
    disable_js?: boolean | null;
    debug?: boolean | null;
    auth?: string | null;
    timeout?: number | null;

    constructor() {
        this.test_id = this.generateUUID();
    }

    private generateUUID(): string {
        let date_ob = new Date();
        // adjust 0 before single digit value
        let date = ('0' + date_ob.getDate()).slice(-2);
        let month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
        let year = date_ob.getFullYear();
        let hour = ('0' + date_ob.getHours()).slice(-2);
        let minute = ('0' + date_ob.getMinutes()).slice(-2);
        let second = ('0' + date_ob.getSeconds()).slice(-2);
        return year + '_' + month + '_' + date + '_' + hour + '_' + minute + '_' + second + '_' + generatePseudoRandomUUID();

        function generatePseudoRandomUUID(): string {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    }
}